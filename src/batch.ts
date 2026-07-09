import { loadBrowserConfig, loadConfig } from './config.js';
import { launchExtensionContext } from './browser.js';
import { waitForEnter } from './prompt.js';
import { formatDurationJa, parseDurationMs } from './duration.js';
import { getArgOverride } from './cli.js';
import { fetchTargets } from './targets.js';
import { updateSingleIssue } from './answerUpdater.js';

// 1件処理してから次の1件に移るまでの間隔。連続してAIチャットに送信し続けることを避ける
const BETWEEN_TICKETS_DELAY_MS = 5000;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

type TicketResult = { issueId: number; subject: string; status: 'success' | 'timeout' | 'error'; detail?: string };

async function main() {
  const config = loadConfig();
  const browserConfig = loadBrowserConfig(config);

  const thresholdOverride = getArgOverride('threshold');
  const thresholdStr = thresholdOverride ?? config.staleThreshold;
  const staleThresholdMs = parseDurationMs(thresholdStr);

  console.log('拡張機能入りのブラウザを起動します...');
  const context = await launchExtensionContext(browserConfig);
  const page = context.pages()[0] ?? (await context.newPage());

  const redmineOrigin = new URL(config.redmine.issuesListUrl).origin;
  await page.goto(redmineOrigin, { waitUntil: 'domcontentloaded' });

  await waitForEnter(
    '\nブラウザが開きました。このウィンドウでRedmineと社内AIチャット（MaruCha）に手動でログインしてください。\n' +
      '（実際にAI回答更新ボタンを押して回答生成まで行うため、社内AIチャットのログインも必要です）\n' +
      'ログインが終わったら、このターミナルでEnterキーを押してください。',
  );

  console.log(
    `\n鮮度切れ判定の閾値: ${thresholdStr}（${formatDurationJa(staleThresholdMs)}）` +
      (thresholdOverride ? ' ※コマンドラインで上書き' : ''),
  );
  const { totalCount, targets } = await fetchTargets(config, staleThresholdMs);
  console.log(`取得件数: ${totalCount}件 / 対象（未回答・鮮度切れ）: ${targets.length}件`);

  if (targets.length === 0) {
    console.log('処理対象のチケットはありませんでした。');
  } else {
    targets.forEach((t) => console.log(`  #${t.issue.id} ${t.issue.subject}`));

    const results: TicketResult[] = [];

    for (const [i, target] of targets.entries()) {
      const { id: issueId, subject } = target.issue;
      console.log(`\n[${i + 1}/${targets.length}] #${issueId} ${subject}`);

      try {
        const result = await updateSingleIssue(page, config, issueId, redmineOrigin, () => process.stdout.write('.'));
        if (result.status === 'success') {
          console.log(`\n  ✓ 更新完了（AI更新日時: ${result.aiUpdatedAt}）`);
          results.push({ issueId, subject, status: 'success' });
        } else {
          console.log('\n  ⚠ タイムアウト');
          results.push({ issueId, subject, status: 'timeout' });
        }
      } catch (err) {
        const detail = err instanceof Error ? err.message : String(err);
        console.log(`  ✗ エラー: ${detail}`);
        results.push({ issueId, subject, status: 'error', detail });
      }

      const isLast = i === targets.length - 1;
      if (!isLast) {
        await sleep(BETWEEN_TICKETS_DELAY_MS);
      }
    }

    const successCount = results.filter((r) => r.status === 'success').length;
    const timeoutCount = results.filter((r) => r.status === 'timeout').length;
    const errorCount = results.filter((r) => r.status === 'error').length;

    console.log('\n=== 結果 ===');
    console.log(`成功: ${successCount}件 / タイムアウト: ${timeoutCount}件 / エラー: ${errorCount}件`);
    for (const r of results.filter((r) => r.status !== 'success')) {
      console.log(`  #${r.issueId} ${r.subject}: ${r.status}${r.detail ? `（${r.detail}）` : ''}`);
    }
  }

  console.log('\n確認が終わったら、このブラウザウィンドウを閉じてください（閉じるとこのプロセスも終了します）。');
  await new Promise<void>((resolve) => {
    context.on('close', () => resolve());
  });
}

main().catch((err) => {
  console.error(`エラー: ${err instanceof Error ? err.message : String(err)}`);
  process.exitCode = 1;
});

import { loadBrowserConfig, loadConfig } from './config.js';
import { launchExtensionContext } from './browser.js';
import { waitForEnter } from './prompt.js';
import { updateSingleIssue, POLL_INTERVAL_MS, POLL_TIMEOUT_MS } from './answerUpdater.js';

async function main() {
  const issueIdArg = process.argv[2];
  if (!issueIdArg || !/^\d+$/.test(issueIdArg)) {
    console.error('使い方: npm run update-one -- <チケットID>');
    process.exitCode = 1;
    return;
  }
  const issueId = Number(issueIdArg);

  const config = loadConfig();
  const browserConfig = loadBrowserConfig(config);

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

  console.log(`\n対象チケット #${issueId} を処理します...`);
  console.log(`「AI回答更新」ボタンをクリックし、Redmine側の更新をポーリングします（最大${POLL_TIMEOUT_MS / 1000}秒、${POLL_INTERVAL_MS / 1000}秒間隔）...`);

  const result = await updateSingleIssue(page, config, issueId, redmineOrigin, () => process.stdout.write('.'));

  if (result.status === 'success') {
    console.log(`\n✓ 更新を検知しました（AI更新日時: ${result.aiUpdatedAt}）`);
  } else {
    console.log(
      '\n⚠ タイムアウトしました。拡張機能側でエラー・タイムアウトが起きた可能性があります。ブラウザ側のボタン表示やコンソールを確認してください。',
    );
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

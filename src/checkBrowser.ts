import { loadBrowserConfig, loadConfig } from './config.js';
import { launchExtensionContext } from './browser.js';
import { fetchAllIssues } from './redmineClient.js';
import { evaluateIssue } from './staleness.js';
import { waitForEnter } from './prompt.js';

const BUTTON_SELECTOR = '#redmaru-ai-answer-btn';
const BUTTON_WAIT_MS = 10000;

async function main() {
  const config = loadConfig();
  const browserConfig = loadBrowserConfig(config);

  console.log('拡張機能入りのChromeを起動します（専用プロファイル・システムのChromeを使用）...');
  const context = await launchExtensionContext(browserConfig);
  const page = context.pages()[0] ?? (await context.newPage());

  const redmineOrigin = new URL(config.redmine.issuesListUrl).origin;
  await page.goto(redmineOrigin, { waitUntil: 'domcontentloaded' });

  await waitForEnter(
    '\nブラウザが開きました。このウィンドウでRedmineと社内AIチャット（MaruCha）に手動でログインしてください。\n' +
      'ログインが終わったら、このターミナルでEnterキーを押してください。',
  );

  console.log('\n対象チケットを1件取得して確認に使います...');
  const issues = await fetchAllIssues(config);
  const target = issues
    .map((issue) => evaluateIssue(issue, config.staleDaysThreshold))
    .find((e) => e.reason !== 'fresh');
  const sampleIssue = target?.issue ?? issues[0] ?? null;

  const targetUrl = sampleIssue ? `${redmineOrigin}/issues/${sampleIssue.id}` : redmineOrigin;
  console.log(`アクセス: ${targetUrl}`);
  await page.goto(targetUrl, { waitUntil: 'domcontentloaded' });

  const currentUrl = page.url();
  if (/\/login/.test(currentUrl)) {
    console.log(`⚠ ログイン画面にリダイレクトされました（${currentUrl}）。ログインが完了していない可能性があります。`);
  } else {
    console.log('✓ ログイン画面へのリダイレクトなし（ログインセッションを認識できています）');
  }

  if (sampleIssue) {
    try {
      await page.waitForSelector(BUTTON_SELECTOR, { timeout: BUTTON_WAIT_MS });
      console.log('✓ 拡張機能の「AI回答更新」ボタンを検出しました（拡張機能は正しく読み込まれています）。');
    } catch {
      console.log(
        `⚠ ${BUTTON_WAIT_MS}ms待っても「AI回答更新」ボタン（${BUTTON_SELECTOR}）が見つかりませんでした。拡張機能が読み込まれているかブラウザのツールバーで確認してください。`,
      );
    }
  } else {
    console.log('チケットが1件も取得できなかったため、ボタン検出はスキップしました。');
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

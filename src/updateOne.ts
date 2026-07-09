import { loadBrowserConfig, loadConfig } from './config.js';
import { launchExtensionContext } from './browser.js';
import { fetchIssue } from './redmineClient.js';
import { waitForEnter } from './prompt.js';
import { AI_UPDATED_FIELD_ID, getCustomFieldValue } from './customFields.js';

const BUTTON_SELECTOR = '#redmaru-ai-answer-btn';
const BUTTON_READY_TIMEOUT_MS = 15000;
const POLL_INTERVAL_MS = 5000;
// 拡張機能側の回答生成タイムアウト（90秒）より余裕を持たせる
const POLL_TIMEOUT_MS = 150000;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

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

  console.log(`\n対象チケット #${issueId} の現在の状態を取得します...`);
  const beforeIssue = await fetchIssue(config, issueId);
  const beforeAiUpdated = getCustomFieldValue(beforeIssue, AI_UPDATED_FIELD_ID);
  console.log(`件名: ${beforeIssue.subject}`);
  console.log(`現在のAI更新日時: ${beforeAiUpdated || '(未設定)'}`);

  const issueUrl = `${redmineOrigin}/issues/${issueId}`;
  console.log(`アクセス: ${issueUrl}`);
  await page.goto(issueUrl, { waitUntil: 'domcontentloaded' });

  console.log('「AI回答更新」ボタンを待機します...');
  const button = await page.waitForSelector(BUTTON_SELECTOR, { timeout: BUTTON_READY_TIMEOUT_MS });

  console.log('ボタンをクリックします...');
  await button.click();

  console.log(`Redmine側の更新をポーリングします（最大${POLL_TIMEOUT_MS / 1000}秒、${POLL_INTERVAL_MS / 1000}秒間隔）...`);
  const deadline = Date.now() + POLL_TIMEOUT_MS;
  let updated = false;
  while (Date.now() < deadline) {
    await sleep(POLL_INTERVAL_MS);
    const current = await fetchIssue(config, issueId);
    const currentAiUpdated = getCustomFieldValue(current, AI_UPDATED_FIELD_ID);
    if (currentAiUpdated && currentAiUpdated !== beforeAiUpdated) {
      updated = true;
      console.log(`\n✓ 更新を検知しました（AI更新日時: ${currentAiUpdated}）`);
      break;
    }
    process.stdout.write('.');
  }

  if (!updated) {
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

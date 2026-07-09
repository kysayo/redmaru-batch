import type { Page } from 'playwright';
import type { Config } from './types.js';
import { fetchIssue } from './redmineClient.js';
import { AI_UPDATED_FIELD_ID, getCustomFieldValue } from './customFields.js';

const BUTTON_SELECTOR = '#redmaru-ai-answer-btn';
const BUTTON_READY_TIMEOUT_MS = 15000;
const POLL_INTERVAL_MS = 5000;
// 拡張機能側の回答生成タイムアウト（90秒）より余裕を持たせる
const POLL_TIMEOUT_MS = 150000;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export type UpdateResult = { status: 'success'; aiUpdatedAt: string } | { status: 'timeout' };

/**
 * 指定チケットのページを開き、「AI回答更新」ボタンをクリックしてRedmine側の
 * 更新（cf_4588の変化）をポーリングで検知する。ボタンが見つからない等のエラーは
 * 呼び出し元にthrowする（タイムアウトのみ正常系の戻り値として扱う）。
 */
export async function updateSingleIssue(
  page: Page,
  config: Config,
  issueId: number,
  redmineOrigin: string,
  onPoll?: () => void,
): Promise<UpdateResult> {
  const beforeIssue = await fetchIssue(config, issueId);
  const beforeAiUpdated = getCustomFieldValue(beforeIssue, AI_UPDATED_FIELD_ID);

  const issueUrl = `${redmineOrigin}/issues/${issueId}`;
  await page.goto(issueUrl, { waitUntil: 'domcontentloaded' });

  const button = await page.waitForSelector(BUTTON_SELECTOR, { timeout: BUTTON_READY_TIMEOUT_MS });
  await button.click();

  const deadline = Date.now() + POLL_TIMEOUT_MS;
  while (Date.now() < deadline) {
    await sleep(POLL_INTERVAL_MS);
    const current = await fetchIssue(config, issueId);
    const currentAiUpdated = getCustomFieldValue(current, AI_UPDATED_FIELD_ID);
    if (currentAiUpdated && currentAiUpdated !== beforeAiUpdated) {
      return { status: 'success', aiUpdatedAt: currentAiUpdated };
    }
    onPoll?.();
  }

  return { status: 'timeout' };
}

export { BUTTON_READY_TIMEOUT_MS, POLL_INTERVAL_MS, POLL_TIMEOUT_MS };

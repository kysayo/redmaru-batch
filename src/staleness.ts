import type { EvaluatedIssue, RedmineIssue } from './types.js';

const AI_UPDATED_FIELD_ID = 4588;
const AI_ANSWER_FIELD_ID = 4589;
const JST_OFFSET_MS = 9 * 60 * 60 * 1000;

/**
 * cf_4588 は "YYYY-MM-DD HH:mm:ss" 形式のJST固定文字列（view-customize/src/script_05.txt と同じ前提）。
 * Node実行環境のタイムゾーンに依存させないため、UTC基準で組み立ててからJSTオフセットを引く。
 */
export function parseJstDatetime(text: string): Date | null {
  const m = text.trim().match(/^(\d{4})-(\d{2})-(\d{2})\s+(\d{2}):(\d{2}):(\d{2})$/);
  if (!m) return null;
  const [, y, mo, d, h, mi, s] = m;
  const utcMs = Date.UTC(Number(y), Number(mo) - 1, Number(d), Number(h), Number(mi), Number(s));
  return new Date(utcMs - JST_OFFSET_MS);
}

function findCustomFieldValue(issue: RedmineIssue, fieldId: number): string {
  const cf = issue.custom_fields?.find((f) => f.id === fieldId);
  const value = cf?.value;
  return typeof value === 'string' ? value.trim() : '';
}

export function evaluateIssue(issue: RedmineIssue, staleDaysThreshold: number): EvaluatedIssue {
  const answerText = findCustomFieldValue(issue, AI_ANSWER_FIELD_ID);
  if (!answerText) {
    return { issue, aiUpdatedOn: null, reason: 'unanswered', staleDays: null };
  }

  const aiUpdatedText = findCustomFieldValue(issue, AI_UPDATED_FIELD_ID);
  const aiUpdatedOn = parseJstDatetime(aiUpdatedText);
  if (!aiUpdatedOn) {
    // AI回答はあるがAI更新日時が未設定・不正 → 比較できないため鮮度切れ扱いにする
    return { issue, aiUpdatedOn: null, reason: 'stale', staleDays: null };
  }

  const updatedOn = new Date(issue.updated_on);
  const diffMs = updatedOn.getTime() - aiUpdatedOn.getTime();
  const staleDays = diffMs / (24 * 60 * 60 * 1000);
  const reason: EvaluatedIssue['reason'] = staleDays > staleDaysThreshold ? 'stale' : 'fresh';

  return { issue, aiUpdatedOn, reason, staleDays };
}

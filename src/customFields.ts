import type { RedmineIssue } from './types.js';

export const AI_UPDATED_FIELD_ID = 4588;
export const AI_ANSWER_FIELD_ID = 4589;

export function getCustomFieldValue(issue: RedmineIssue, fieldId: number): string {
  const cf = issue.custom_fields?.find((f) => f.id === fieldId);
  const value = cf?.value;
  return typeof value === 'string' ? value.trim() : '';
}

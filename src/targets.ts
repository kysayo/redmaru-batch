import type { Config, EvaluatedIssue } from './types.js';
import { fetchAllIssues } from './redmineClient.js';
import { evaluateIssue } from './staleness.js';

export interface TargetsResult {
  /** issuesListUrlの条件に合致した全チケット数（"最新"判定のものも含む） */
  totalCount: number;
  /** 未回答・鮮度切れのチケットのみ（"最新"判定のものは除外） */
  targets: EvaluatedIssue[];
}

export async function fetchTargets(config: Config, staleThresholdMs: number): Promise<TargetsResult> {
  const issues = await fetchAllIssues(config);
  const targets = issues.map((issue) => evaluateIssue(issue, staleThresholdMs)).filter((e) => e.reason !== 'fresh');
  return { totalCount: issues.length, targets };
}

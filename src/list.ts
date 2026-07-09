import { loadConfig } from './config.js';
import { fetchAllIssues } from './redmineClient.js';
import { evaluateIssue } from './staleness.js';
import type { EvaluatedIssue } from './types.js';

function formatRow(evaluated: EvaluatedIssue) {
  const { issue, reason, staleDays } = evaluated;
  return {
    ID: issue.id,
    件名: issue.subject.length > 30 ? `${issue.subject.slice(0, 30)}…` : issue.subject,
    ステータス: issue.status?.name ?? '',
    更新日時: issue.updated_on,
    判定: reason === 'unanswered' ? '未回答' : reason === 'stale' ? '鮮度切れ' : '最新',
    鮮度差分日数: staleDays === null ? '-' : staleDays.toFixed(2),
  };
}

async function main() {
  const config = loadConfig();
  const issues = await fetchAllIssues(config);

  const evaluated = issues.map((issue) => evaluateIssue(issue, config.staleDaysThreshold));
  const targets = evaluated.filter((e) => e.reason !== 'fresh');

  console.log(`取得件数: ${issues.length}件 / 対象（未回答・鮮度切れ）: ${targets.length}件\n`);

  if (targets.length > 0) {
    console.table(targets.map(formatRow));
  }
}

main().catch((err) => {
  console.error(`エラー: ${err instanceof Error ? err.message : String(err)}`);
  process.exitCode = 1;
});

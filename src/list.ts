import { loadConfig } from './config.js';
import { fetchTargets } from './targets.js';
import { formatDurationJa, parseDurationMs } from './duration.js';
import { getArgOverride } from './cli.js';
import type { EvaluatedIssue } from './types.js';

function formatRow(evaluated: EvaluatedIssue) {
  const { issue, reason, staleDiffMs } = evaluated;
  return {
    ID: issue.id,
    件名: issue.subject.length > 30 ? `${issue.subject.slice(0, 30)}…` : issue.subject,
    ステータス: issue.status?.name ?? '',
    更新日時: issue.updated_on,
    判定: reason === 'unanswered' ? '未回答' : reason === 'stale' ? '鮮度切れ' : '最新',
    鮮度差分: staleDiffMs === null ? '-' : formatDurationJa(staleDiffMs),
  };
}

async function main() {
  const config = loadConfig();

  const thresholdOverride = getArgOverride('threshold');
  const thresholdStr = thresholdOverride ?? config.staleThreshold;
  const staleThresholdMs = parseDurationMs(thresholdStr);
  console.log(
    `鮮度切れ判定の閾値: ${thresholdStr}（${formatDurationJa(staleThresholdMs)}）` +
      (thresholdOverride ? ' ※コマンドラインで上書き' : ''),
  );

  const { totalCount, targets } = await fetchTargets(config, staleThresholdMs);
  console.log(`取得件数: ${totalCount}件 / 対象（未回答・鮮度切れ）: ${targets.length}件\n`);

  if (targets.length > 0) {
    console.table(targets.map(formatRow));
  }
}

main().catch((err) => {
  console.error(`エラー: ${err instanceof Error ? err.message : String(err)}`);
  process.exitCode = 1;
});

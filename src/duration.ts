const UNIT_MS: Record<string, number> = {
  s: 1000,
  m: 60 * 1000,
  h: 60 * 60 * 1000,
  d: 24 * 60 * 60 * 1000,
};

/** "5m" → 300000 のように単位付きの短い期間表記をミリ秒に変換する。対応単位: s(秒) m(分) h(時) d(日) */
export function parseDurationMs(input: string): number {
  const m = input.trim().match(/^(\d+(?:\.\d+)?)(s|m|h|d)$/);
  if (!m) {
    throw new Error(
      `不正な期間指定です: "${input}"（例: "30s"=30秒, "5m"=5分, "1h"=1時間, "1d"=1日）`,
    );
  }
  const [, num, unit] = m;
  return Number(num) * UNIT_MS[unit];
}

/** ミリ秒を "1日2時間"のような日本語の読みやすい表記にする（表示専用） */
export function formatDurationJa(ms: number): string {
  const totalSeconds = Math.round(Math.abs(ms) / 1000);
  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  const parts: string[] = [];
  if (days) parts.push(`${days}日`);
  if (hours) parts.push(`${hours}時間`);
  if (!days && minutes) parts.push(`${minutes}分`);
  if (!days && !hours && seconds) parts.push(`${seconds}秒`);

  return parts.length ? parts.join('') : '0秒';
}

/** "--threshold=5m" のような "--flag=value" 形式のコマンドライン引数を取り出す */
export function getArgOverride(flag: string): string | null {
  const prefix = `--${flag}=`;
  const arg = process.argv.slice(2).find((a) => a.startsWith(prefix));
  return arg ? arg.slice(prefix.length) : null;
}

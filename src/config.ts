import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import type { BrowserConfig, Config } from './types.js';

const CONFIG_PATH = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'config.json');

export function loadConfig(): Config {
  let raw: string;
  try {
    raw = readFileSync(CONFIG_PATH, 'utf-8');
  } catch {
    throw new Error(
      `設定ファイルが見つかりません: ${CONFIG_PATH}\nconfig.example.json をコピーして config.json を作成し、値を埋めてください。`,
    );
  }

  let config: Partial<Config>;
  try {
    config = JSON.parse(raw);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    throw new Error(
      `${CONFIG_PATH} のJSONとしての読み込みに失敗しました: ${message}\n` +
        'よくある原因: (1) issuesListUrl等の値に生の "（ダブルクォート）や改行が混ざっている ' +
        '(2) Windowsのパスを "C:\\Users\\..." のようにバックスラッシュ区切りで書いている' +
        '（JSONでは \\ がエスケープ文字になるため構文エラーになる。"C:/Users/..." のように / 区切りにすること）',
    );
  }

  if (!config.redmine?.issuesListUrl) {
    throw new Error('config.json の redmine.issuesListUrl が未設定です。');
  }
  if (!config.redmine?.apiKey || config.redmine.apiKey === 'YOUR_REDMINE_API_KEY') {
    throw new Error('config.json の redmine.apiKey が未設定です。');
  }
  if (typeof config.staleDaysThreshold !== 'number') {
    throw new Error('config.json の staleDaysThreshold（数値・日数）が未設定です。');
  }

  return config as Config;
}

export function loadBrowserConfig(config: Config): BrowserConfig {
  if (!config.browser?.extensionPath) {
    throw new Error('config.json の browser.extensionPath が未設定です（拡張機能ビルドフォルダへのパス）。');
  }
  if (!config.browser?.userDataDir) {
    throw new Error('config.json の browser.userDataDir が未設定です（Playwright専用のChromeプロファイル保存先）。');
  }

  const manifestPath = path.join(config.browser.extensionPath, 'manifest.json');
  if (!existsSync(manifestPath)) {
    throw new Error(
      `config.json の browser.extensionPath（${config.browser.extensionPath}）に manifest.json が見つかりません。\n` +
        'このPC上での拡張機能フォルダの場所（自分でビルドした .output/chrome-mv3 か、チーム配布用に展開したフォルダか）に合わせて書き換えてください。',
    );
  }

  return config.browser;
}

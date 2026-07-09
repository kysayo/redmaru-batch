import { readFileSync } from 'node:fs';
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

  const config = JSON.parse(raw) as Partial<Config>;

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
  return config.browser;
}

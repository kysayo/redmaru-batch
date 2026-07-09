import { chromium, type BrowserContext } from 'playwright';
import type { BrowserConfig } from './types.js';

/**
 * 拡張機能入りのChromeを起動する。
 * MV3拡張のロードにはPersistent Context + headed実行が必要（Playwright仕様）。
 * channel:'chrome' でPlaywright同梱のChromiumではなくシステムにインストール済みのGoogle Chromeを使う
 * （SSO・Windows Hello等の企業ポリシーが素のChromiumだと正しく動かない可能性があるため）。
 */
export async function launchExtensionContext(config: BrowserConfig): Promise<BrowserContext> {
  return chromium.launchPersistentContext(config.userDataDir, {
    channel: 'chrome',
    headless: false,
    args: [
      `--disable-extensions-except=${config.extensionPath}`,
      `--load-extension=${config.extensionPath}`,
    ],
  });
}

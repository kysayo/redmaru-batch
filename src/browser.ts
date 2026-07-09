import { chromium, type BrowserContext } from 'playwright';
import type { BrowserConfig } from './types.js';

/**
 * 拡張機能入りのブラウザを起動する。
 * MV3拡張のロードにはPersistent Context + headed実行が必要（Playwright仕様）。
 *
 * 当初はsystem Chrome（channel:'chrome'）を使う想定だったが、Google Chromeは
 * バージョン137以降、stable版で `--load-extension` 系のコマンドライン引数による
 * 拡張機能読み込みをセキュリティ上の理由で無効化しており、実機（Chrome 150）で
 * 拡張機能が全く読み込まれないことを確認した。そのためPlaywright同梱の
 * Chromium（`npx playwright install chromium` が必要）を使う。
 * SSO・Windows Hello等がChromiumでも本物のChromeと同様に動作するかは
 * `docs/handoff-ai-answer-automation.md` に記載の未検証事項。
 */
export async function launchExtensionContext(config: BrowserConfig): Promise<BrowserContext> {
  return chromium.launchPersistentContext(config.userDataDir, {
    headless: false,
    args: [
      `--disable-extensions-except=${config.extensionPath}`,
      `--load-extension=${config.extensionPath}`,
    ],
  });
}

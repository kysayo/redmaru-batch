import type { Config, RedmineIssue, RedmineIssuesResponse } from './types.js';

const PAGE_LIMIT = 100;

function buildIssuesJsonUrl(issuesListUrl: string): URL {
  const url = new URL(issuesListUrl);
  // グローバル一覧（/issues）・プロジェクト配下一覧（/projects/xxx/issues）どちらにも対応する
  if (!url.pathname.endsWith('.json')) {
    url.pathname = `${url.pathname}.json`;
  }
  return url;
}

export async function fetchAllIssues(config: Config): Promise<RedmineIssue[]> {
  const baseUrl = buildIssuesJsonUrl(config.redmine.issuesListUrl);
  const issues: RedmineIssue[] = [];
  let offset = 0;

  for (;;) {
    const url = new URL(baseUrl);
    url.searchParams.set('limit', String(PAGE_LIMIT));
    url.searchParams.set('offset', String(offset));

    const res = await fetch(url, {
      headers: { 'X-Redmine-API-Key': config.redmine.apiKey },
    });
    if (!res.ok) {
      throw new Error(`Redmine APIエラー: ${res.status} ${res.statusText}（URL: ${url}）`);
    }

    const contentType = res.headers.get('content-type') ?? '';
    const bodyText = await res.text();
    if (!contentType.includes('application/json')) {
      throw new Error(
        `Redmine APIからJSON以外のレスポンスが返されました（URL: ${url}）。\n` +
          'APIキーが正しいか、issuesListUrlのパスが正しいか（プロジェクト配下のURLの場合は /projects/xxx/issues の形式か）を確認してください。\n' +
          `レスポンス先頭: ${bodyText.slice(0, 200)}`,
      );
    }

    const data = JSON.parse(bodyText) as RedmineIssuesResponse;
    issues.push(...data.issues);

    offset += data.issues.length;
    if (data.issues.length === 0 || offset >= data.total_count) break;
  }

  return issues;
}

export async function fetchIssue(config: Config, issueId: number): Promise<RedmineIssue> {
  const redmineOrigin = new URL(config.redmine.issuesListUrl).origin;
  const url = `${redmineOrigin}/issues/${issueId}.json`;

  const res = await fetch(url, {
    headers: { 'X-Redmine-API-Key': config.redmine.apiKey },
  });
  if (!res.ok) {
    throw new Error(`Redmine APIエラー: ${res.status} ${res.statusText}（URL: ${url}）`);
  }

  const data = (await res.json()) as { issue: RedmineIssue };
  return data.issue;
}

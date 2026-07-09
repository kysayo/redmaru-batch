export interface Config {
  redmine: {
    issuesListUrl: string;
    apiKey: string;
  };
  /** 期間文字列（例: "1d"=1日, "5m"=5分, "1h"=1時間, "30s"=30秒） */
  staleThreshold: string;
  browser?: {
    extensionPath: string;
    userDataDir: string;
  };
}

export type BrowserConfig = NonNullable<Config['browser']>;

export interface RedmineCustomField {
  id: number;
  name: string;
  value: unknown;
}

export interface RedmineIssue {
  id: number;
  subject: string;
  tracker?: { name: string };
  status?: { name: string };
  updated_on: string;
  custom_fields?: RedmineCustomField[];
}

export interface RedmineIssuesResponse {
  issues: RedmineIssue[];
  total_count: number;
  offset: number;
  limit: number;
}

export type StaleReason = 'unanswered' | 'stale' | 'fresh';

export interface EvaluatedIssue {
  issue: RedmineIssue;
  aiUpdatedOn: Date | null;
  reason: StaleReason;
  /** 閾値との比較に使ったAI更新日時とチケット更新日時の差（ミリ秒） */
  staleDiffMs: number | null;
}

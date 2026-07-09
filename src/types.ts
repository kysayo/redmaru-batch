export interface Config {
  redmine: {
    issuesListUrl: string;
    apiKey: string;
  };
  staleDaysThreshold: number;
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
  staleDays: number | null;
}

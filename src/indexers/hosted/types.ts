export type IndexerExecutionStatus = "success" | "failure" | "inProgress";

export type IndexerExecutionResult = {
  status: IndexerExecutionStatus;
  startTimeUtc: string;
  endTimeUtc?: string;
  errors: string[];
  warnings: string[];
};

export type IndexerExecutionHistory = {
  results: IndexerExecutionResult[]; // the size of this array is bounded - see trimIndexerExecutionHistoryIfNeeded
};

export type WebScraperDataSourceConfig = {
  // List of sitemap urls.
  // Exactly one of sitemaps or urls must be present
  sitemaps?: string[];
  // List of urls
  urls?: string[];
  // If specified, only the urls (after sitemap expanstion, if any) matching any of these prefixes are indexed
  // At most one of urlPrefixesToInclude and urlPrefixesToExclude can be present
  urlPrefixesToInclude?: string[];
  // If specified, the urls (after sitemap expanstion, if any) matching any of these prefixes are excluded from indexing
  urlPrefixesToExclude?: string[];
};

export type GithubDataSourceConfig = {
  owner: string;
  repo: string;
  code?: { branch?: string; pathPatterns?: string[] };
};

export type IndexerDataSource =
  | {
      type: "webScraper";
      config: WebScraperDataSourceConfig;
    }
  | {
      type: "github";
      config: GithubDataSourceConfig;
    };

export type IndexerDataTarget = {
  catalogName: string;
};

export enum IndexerScheduleFrequency {
  OnDemand = "once", // Note the different from the REST API, which uses "once"
  Daily = "daily",
  Weekly = "weekly",
  Monthly = "monthly",
};

export type IndexerSchedule = {
  frequency: IndexerScheduleFrequency;
};

export type Indexer = {
  name: string;
  dataSource: IndexerDataSource;
  dataTarget: IndexerDataTarget;
  schedule: IndexerSchedule;
};
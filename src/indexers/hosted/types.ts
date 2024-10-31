import { CortexApiClient } from "../../api-client";

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
}

export type IndexerSchedule = {
  frequency: IndexerScheduleFrequency;
};

export type IndexerConfig = {
  name: string;
  dataSource: IndexerDataSource;
  dataTarget: IndexerDataTarget;
  schedule: IndexerSchedule;
};

export class Indexer {
  static async get(
    apiClient: CortexApiClient,
    name: string,
  ): Promise<IndexerConfig> {
    const res = await apiClient.GET(`/indexers/${name}`);
    if (res.status !== 200) {
      throw new Error(`Failed to get indexer: ${res.statusText}`);
    }
    return res.json();
  }

  static async create(
    apiClient: CortexApiClient,
    name: string,
    catalogName: string,
    schedule: IndexerScheduleFrequency,
    dataSource: IndexerDataSource,
  ): Promise<IndexerConfig> {
    const indexer: IndexerConfig = {
      name,
      dataSource,
      dataTarget: { catalogName },
      schedule: { frequency: schedule },
    };
    const res = await apiClient.POST(`/indexers`, indexer);
    if (res.status !== 201) {
      throw new Error(`Failed to create indexer: ${res.statusText}`);
    }
    return indexer;
  }

  static async update(
    apiClient: CortexApiClient,
    indexer: IndexerConfig,
  ): Promise<IndexerConfig> {
    const res = await apiClient.PUT(`/indexers/${indexer.name}`, indexer);
    if (res.status !== 200) {
      throw new Error(`Failed to update indexer: ${res.statusText}`);
    }
    return indexer;
  }

  static async list(apiClient: CortexApiClient): Promise<IndexerConfig[]> {
    const res = await apiClient.GET(`/indexers`);
    if (res.status !== 200) {
      throw new Error(`Failed to list indexers: ${res.statusText}`);
    }
    return res.json();
  }

  static async delete(apiClient: CortexApiClient, name: string): Promise<void> {
    const res = await apiClient.DELETE(`/indexers/${name}`);
    if (res.status !== 200) {
      throw new Error(`Failed to delete indexer: ${res.statusText}`);
    }
  }

  static async run(apiClient: CortexApiClient, name: string): Promise<void> {
    const res = await apiClient.POST(`/indexers/${name}/run`);
    if (res.status !== 200) {
      throw new Error(`Failed to run indexer: ${res.statusText}`);
    }
  }

  static async getExecutionHistory(
    apiClient: CortexApiClient,
    name: string,
  ): Promise<IndexerExecutionHistory> {
    const res = await apiClient.GET(`/indexers/${name}/history`);
    if (res.status !== 200) {
      throw new Error(
        `Failed to get indexer execution history: ${res.statusText}`,
      );
    }
    return res.json();
  }
}

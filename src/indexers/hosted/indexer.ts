import { setTimeout } from "timers/promises";
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
  results: IndexerExecutionResult[]; // the size of this array is bounded to the most recent 100 executions
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

export type RunOptions = { waitForCompletion: boolean };

export class Indexer {
  private constructor(
    readonly config: IndexerConfig,
    private readonly apiClient: CortexApiClient,
  ) {}

  static async get(apiClient: CortexApiClient, name: string): Promise<Indexer> {
    const res = await apiClient.GET(`/indexers/${name}`);
    if (res.status !== 200) {
      throw new Error(`Failed to get indexer: ${res.statusText}`);
    }
    const config = await res.json();
    return new Indexer(config, apiClient);
  }

  static async create(
    apiClient: CortexApiClient,
    name: string,
    catalogName: string,
    schedule: IndexerScheduleFrequency,
    dataSource: IndexerDataSource,
  ): Promise<Indexer> {
    const indexer: IndexerConfig = {
      name,
      dataSource,
      dataTarget: { catalogName },
      schedule: { frequency: schedule },
    };
    const res = await apiClient.POST(`/indexers`, indexer);
    if (res.status !== 201) {
      const message = res.status === 400 ? await res.text() : res.statusText;
      throw new Error(`Failed to create indexer: ${message}`);
    }
    return new Indexer(indexer, apiClient);
  }

  static async list(apiClient: CortexApiClient): Promise<Indexer[]> {
    const res = await apiClient.GET(`/indexers`);
    if (res.status !== 200) {
      throw new Error(`Failed to list indexers: ${res.statusText}`);
    }

    const indexers: IndexerConfig[] = (await res.json()).indexers;
    return indexers.map((indexer) => new Indexer(indexer, apiClient));
  }

  async update(): Promise<void> {
    const res = await this.apiClient.PUT(
      `/indexers/${this.config.name}`,
      this.config,
    );
    if (res.status !== 200) {
      const message = res.status === 400 ? await res.text() : res.statusText;
      throw new Error(`Failed to update indexer: ${message}`);
    }
  }

  async delete(): Promise<void> {
    const res = await this.apiClient.DELETE(`/indexers/${this.config.name}`);
    if (res.status !== 200) {
      throw new Error(`Failed to delete indexer: ${res.statusText}`);
    }
  }

  async run(): Promise<void>;
  async run(options: { waitForCompletion: false }): Promise<void>;
  async run(options: {
    waitForCompletion: true;
  }): Promise<IndexerExecutionResult>;
  async run(options?: RunOptions): Promise<void | IndexerExecutionResult> {
    const res = await this.apiClient.POST(`/indexers/${this.config.name}/run`);
    // 200 is returned if the indexer was already running, 202 is returned if the indexer was started
    if (res.status !== 202 && res.status !== 200) {
      const message = res.status === 400 ? await res.text() : res.statusText;
      throw new Error(`Failed to run indexer: ${message}`);
    }

    if (!options?.waitForCompletion) {
      return;
    }

    let executionResult: IndexerExecutionResult | undefined;
    while (!executionResult) {
      const history: IndexerExecutionHistory = await this.getExecutionHistory();
      if (
        history &&
        history.results.length > 0 &&
        history.results[0].status !== "inProgress"
      ) {
        executionResult = history.results[0];
      } else {
        await setTimeout(500);
      }
    }
    return executionResult;
  }

  async getExecutionHistory(): Promise<IndexerExecutionHistory> {
    const res = await this.apiClient.GET(
      `/indexers/${this.config.name}/history`,
    );
    if (res.status !== 200) {
      throw new Error(
        `Failed to get indexer execution history: ${res.statusText}`,
      );
    }
    return await res.json();
  }
}

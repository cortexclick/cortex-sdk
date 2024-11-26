import { expect, test, beforeEach, afterEach } from "vitest";
import { Catalog, CatalogConfig } from "../../catalog";
import { testClient } from "../../vitest-test-client";
import {
  GithubDataSourceConfig,
  Indexer,
  IndexerScheduleFrequency,
  WebScraperDataSourceConfig,
} from "./indexer";

let catalog: Catalog;

beforeEach(async () => {
  const config: CatalogConfig = {
    description: "foo bar",
    instructions: ["a", "b"],
  };

  const catalogName = `catalog-hosted-indexers-test-${Date.now()}`;
  catalog = await testClient.configureCatalog(catalogName, config);
}, 30000);

afterEach(async () => {
  if (catalog) {
    await catalog.delete(); // this will also delete any indexer referencing this catalog
  }
}, 30000);

test("Test hosted indexer APIs", { timeout: 60000 }, async () => {
  const indexerName = `indexer-sdk-test-web-${Date.now()}`;
  const config: WebScraperDataSourceConfig = {
    urls: ["https://www.cortexclick.com"],
  };
  const indexer: Indexer = await testClient.createWebScraperIndexer(
    indexerName,
    catalog.name,
    IndexerScheduleFrequency.OnDemand,
    config,
  );

  const retrievedIndexer: Indexer = await testClient.getIndexer(indexerName);
  expect(retrievedIndexer.config).toMatchObject(indexer.config);

  const list = await testClient.listIndexers();
  expect(list).toHaveLength(1);
  expect(list[0].config).toMatchObject(indexer.config);

  const executionResult = await indexer.run({ waitForCompletion: true });

  expect(executionResult.status).toBe("success");
  expect(executionResult.errors).toHaveLength(0);
  expect(executionResult.warnings).toHaveLength(0);

  await indexer.delete();
});

test("Can create Github indexer", { timeout: 60000 }, async () => {
  const indexerName = `indexer-sdk-test-gh-${Date.now()}`;
  const config: GithubDataSourceConfig = {
    owner: "cortexclick",
    repo: "cortex-sdk",
  };

  await testClient.createGithubIndexer(
    indexerName,
    catalog.name,
    IndexerScheduleFrequency.OnDemand,
    config,
  );
});

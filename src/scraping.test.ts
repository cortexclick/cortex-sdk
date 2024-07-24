import { expect, test } from "vitest";
import { CatalogConfig } from "./catalog";
import { SitemapDocument, UrlDocument } from "./document";
import { testClient } from "./src/vitest-test-client";

const runScraperTests = process.env.RUN_SCRAPER_TESTS === "true";

const expectedSitemapUrls = 4;

test.skipIf(!runScraperTests)(
  "Test scraping single URL",
  { timeout: 60000 },
  async () => {
    const catalogName = `catalog-${Math.floor(Math.random() * 10000)}`;

    const config: CatalogConfig = {
      description: "foo bar",
      instructions: ["a", "b"],
    };

    const catalog = await testClient.configureCatalog(catalogName, config);

    const docs: UrlDocument[] = [
      {
        url: "https://www.cortexclick.com/",
        contentType: "url",
      },
    ];

    await catalog.upsertDocuments(docs);

    let docsFound = false;

    while (!docsFound) {
      const docCount = await catalog.documentCount();
      if (docCount === 1) {
        docsFound = true;
      } else {
        console.log("no docs found. sleeping...");
        await sleep(5000);
      }
    }

    const docCount = await catalog.documentCount();
    expect(docCount).toBe(1);

    await catalog.delete();
  },
);

test.skipIf(!runScraperTests)(
  "Test scraping sitemap",
  { timeout: 60000 },
  async () => {
    const catalogName = `catalog-${Math.floor(Math.random() * 10000)}`;

    const config: CatalogConfig = {
      description: "foo bar",
      instructions: ["a", "b"],
    };

    const catalog = await testClient.configureCatalog(catalogName, config);

    const docs: SitemapDocument[] = [
      {
        sitemapUrl: "https://www.cortexclick.com/sitemap.xml",
        contentType: "sitemap-url",
      },
    ];

    await catalog.upsertDocuments(docs);

    let docsFound = false;

    while (!docsFound) {
      const docCount = await catalog.documentCount();
      if (docCount === expectedSitemapUrls) {
        docsFound = true;
      } else {
        console.log(`${docCount} docs found. sleeping...`);
        await sleep(5000);
      }
    }

    await catalog.delete();
  },
);

test.skipIf(!runScraperTests)(
  "Test isolation of scraping multiple catalogs at once",
  { timeout: 60000 },
  async () => {
    const catalogName1 = `catalog-${Math.floor(Math.random() * 10000)}`;
    const catalogName2 = `catalog-${Math.floor(Math.random() * 10000)}`;
    const catalogName3 = `catalog-${Math.floor(Math.random() * 10000)}`;
    const catalogName4 = `catalog-${Math.floor(Math.random() * 10000)}`;
    const catalogName5 = `catalog-${Math.floor(Math.random() * 10000)}`;

    const config: CatalogConfig = {
      description: "foo bar",
      instructions: ["a", "b"],
    };

    const catalog1 = await testClient.configureCatalog(catalogName1, config);
    const catalog2 = await testClient.configureCatalog(catalogName2, config);
    const catalog3 = await testClient.configureCatalog(catalogName3, config);
    const catalog4 = await testClient.configureCatalog(catalogName4, config);
    const catalog5 = await testClient.configureCatalog(catalogName5, config);

    const docs: SitemapDocument[] = [
      {
        sitemapUrl: "https://www.cortexclick.com/sitemap.xml",
        contentType: "sitemap-url",
      },
    ];

    catalog1.upsertDocuments(docs);
    catalog2.upsertDocuments(docs);
    catalog3.upsertDocuments(docs);
    catalog4.upsertDocuments(docs);
    catalog5.upsertDocuments(docs);

    let docsFound = false;

    while (!docsFound) {
      const catalog1Count = await catalog1.documentCount();
      const catalog2Count = await catalog2.documentCount();
      const catalog3Count = await catalog3.documentCount();
      const catalog4Count = await catalog4.documentCount();
      const catalog5Count = await catalog5.documentCount();
      if (
        [
          catalog1Count,
          catalog2Count,
          catalog3Count,
          catalog4Count,
          catalog5Count,
        ].every((e) => e === 4)
      ) {
        docsFound = true;
      } else {
        await sleep(5000);
      }
    }

    await catalog1.delete();
    await catalog2.delete();
    await catalog3.delete();
    await catalog4.delete();
    await catalog5.delete();
  },
);

function sleep(ms: number) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

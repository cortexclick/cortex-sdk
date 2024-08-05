import { expect, test } from "vitest";
import { CatalogConfig } from "./catalog";
import { SitemapDocument, UrlDocument } from "./document";
import { testClient } from "./vitest-test-client";

const runScraperTests = process.env.RUN_SCRAPER_TESTS === "true";

const expectedSitemapUrls = 28;

function getRandomCatalogName(): string {
  // return a random name with a recongizable prefix and timestamp (so it's reasy to clean up leaks and identify problematic tests)
  // Still use a random part because toISOString() only has millisecond resolution
  return `sdk-scraper-test-${new Date().toISOString().replace(/[.:]/g, "-")}-${Math.floor(Math.random() * 1000)}`;
}

test.skipIf(!runScraperTests)(
  "Test scraping single URL",
  { timeout: 60000 },
  async () => {
    const catalogName = getRandomCatalogName();

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
  { timeout: 120000 },
  async () => {
    const catalogName = getRandomCatalogName();

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
  { timeout: 120000 },
  async () => {
    const catalogName1 = getRandomCatalogName();
    const catalogName2 = getRandomCatalogName();
    const catalogName3 = getRandomCatalogName();

    const config: CatalogConfig = {
      description: "foo bar",
      instructions: ["a", "b"],
    };

    const catalog1 = await testClient.configureCatalog(catalogName1, config);
    const catalog2 = await testClient.configureCatalog(catalogName2, config);
    const catalog3 = await testClient.configureCatalog(catalogName3, config);

    const docs: SitemapDocument[] = [
      {
        sitemapUrl: "https://www.cortexclick.com/sitemap.xml",
        contentType: "sitemap-url",
      },
    ];

    catalog1.upsertDocuments(docs);
    catalog2.upsertDocuments(docs);
    catalog3.upsertDocuments(docs);

    let docsFound = false;

    while (!docsFound) {
      const count1 = await catalog1.documentCount();
      const count2 = await catalog2.documentCount();
      const count3 = await catalog3.documentCount();
      if ([count1, count2, count3].every((e) => e === expectedSitemapUrls)) {
        docsFound = true;
      } else {
        console.log(
          `Waiting for all 3 catalogs to be populated. C1: ${count1}, C2: ${count2}, C3: ${count3} docs found. sleeping...`,
        );
        await sleep(5000);
      }
    }

    await catalog1.delete();
    await catalog2.delete();
    await catalog3.delete();
  },
);

function sleep(ms: number) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

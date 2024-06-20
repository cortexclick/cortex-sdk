import { expect, test, beforeEach, afterEach } from 'vitest'
import { CortexClient } from "../index";
import { Catalog, CatalogConfig } from "../catalog";
import { JSONDocument } from '../document';

const client = new CortexClient({
  accessToken: process.env.CORTEX_ACCESS_TOKEN || "",
  org: "cortex-click-test",
  apiUrl: "http://localhost:3001",
});

let catalog: Catalog;

beforeEach(async () => {
  const config: CatalogConfig = {
    description: "foo bar",
    instructions: ["a", "b"],
  };
  
  const catalogName = `catalog-${Math.floor(Math.random() * 10000)}`;
  catalog = await client.configureCatalog(catalogName, config);
});

afterEach(async () => {
  if (catalog) {
    await catalog.delete();
  }
});

test('Test catalog.jsonIndexer with custom opts', { timeout: 10000 }, async () => {
  const docs: JSONDocument[] = [];

  for (let i = 0; i < 76; i++) {
    docs.push({
      documentId: `${i}`,
      contentType: "json",
      content: {
        foo: "buzz",
        a: [5, 6, 7]
      },
      url: "https://foo.com",
      imageUrl: "https://foo.com/image.jpg"
    });
  }

  const indexer = catalog.jsonIndexer(docs, { getId: doc => doc.documentId, getUrl: doc => doc.url, getImageUrl: doc => doc.imageUrl });

  await indexer.index();

  const docCount = await catalog.documentCount();
  expect(docCount).toBe(76);
});

test('Test catalog.jsonIndexer with default opts', { timeout: 10000 }, async () => {
  const docs: JSONDocument[] = [];

  for (let i = 0; i < 76; i++) {
    docs.push({
      documentId: `${i}`,
      contentType: "json",
      content: {
        foo: "buzz",
        a: [5, 6, 7]
      },
      url: "https://foo.com",
      imageUrl: "https://foo.com/image.jpg"
    });
  }

  const indexer = catalog.jsonIndexer(docs);

  await indexer.index();

  const docCount = await catalog.documentCount();
  expect(docCount).toBe(76);
});

test('Test catalog.directoryIndexer', { timeout: 10000 }, async () => {
  const indexer = catalog.directoryIndexer({
    rootDir: "./test_data",
  })

  await indexer.index();

  const docCount = await catalog.documentCount();
  expect(docCount).toBe(2);
});

test('Test catalog.tsvIndexer with default opts', { timeout: 10000 }, async () => {
  const indexer = catalog.tsvIndexer("./test_data/test.tsv");

  await indexer.index();

  const docCount = await catalog.documentCount();
  expect(docCount).toBe(2);
});

test('Test catalog.tsvIndexer with custom opts', { timeout: 10000 }, async () => {
  const indexer = catalog.tsvIndexer("./test_data/test.tsv", { getId: doc => doc.id });

  await indexer.index();

  const docCount = await catalog.documentCount();
  expect(docCount).toBe(2);
});

test('Test catalog.shopifyIndexer', { timeout: 10000 }, async () => {
  const indexer = catalog.shopifyIndexer({
    shopifyBaseUrl: "https://redsflyfishing.com",
    maxItems: 5,
  })

  await indexer.index();

  const docCount = await catalog.documentCount();
  expect(docCount).toBe(5);
});
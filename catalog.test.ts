import { expect, test, beforeEach, afterEach } from 'vitest'
import { CortexClient } from "./index";
import { Catalog, CatalogConfig } from "./catalog";

const client = new CortexClient({
  accessToken: process.env.CORTEX_ACCESS_TOKEN || "",
  org: "cortex-click-test",
  apiUrl: "http://localhost:3001",
});

let catalog: Catalog;

afterEach(async () => {
  try {
    if (catalog) {
      await catalog.delete();
    }
  }
  catch {
    // probably catalog has already been deleted by a test, so ignore 
  }
});

test('Catalog CRUD', async () => {

  const catalogName = `catalog-${Math.floor(Math.random() * 10000)}`

  const config: CatalogConfig = {
    description: "foo bar",
    instructions: ["a", "b"],
  };

  // create
  catalog = await client.configureCatalog(catalogName, config);

  // get
  catalog = await client.getCatalog(catalogName);
  expect(catalog.config.instructions).toStrictEqual(config.instructions);
  expect(catalog.config.description).toBe(config.description);

  // update
  config.description = "buzz 123"
  config.instructions = ["1", "2", "3"]
  catalog = await client.configureCatalog(catalogName, config);

  catalog = await client.getCatalog(catalogName);
  expect(catalog.config.instructions).toStrictEqual(config.instructions);
  expect(catalog.config.description).toBe(config.description);

  // get documentCount

  const docCount = await catalog.documentCount();
  expect(docCount).toBe(0);

  // list
  const catalogList = await client.listCatalogs();
  const catalogFromList = catalogList.find(c => c.name === catalogName);
  expect(catalogFromList).toBeDefined();
  expect(catalogFromList?.documentCount).toBe(0);
  expect(catalogFromList?.description).toBe(config.description);
  // get catalog from list result
  const getCatalogFromList = await catalogFromList?.Catalog();
  expect(getCatalogFromList?.config.instructions).toStrictEqual(config.instructions);

  // delete 
  await catalog.delete();
  // assert that the get fails
  await expect(async () => { await client.getCatalog(catalogName) }).rejects.toThrowError("Failed to get catalog: Not Found");
});

import { expect, test, afterEach } from "vitest";
import { Catalog, CatalogConfig } from "./catalog";
import { testClient } from "./vitest-test-client";

let catalog: Catalog | undefined;

afterEach(async () => {
  if (catalog) {
    await catalog.delete();
  }
}, 20000);

test("Catalog CRUD", { timeout: 60000 }, async () => {
  const catalogName = `catalog-sdk-test-${Date.now()}`;

  const config: CatalogConfig = {
    description: "foo bar",
    instructions: ["a", "b"],
  };

  // create
  catalog = await testClient.configureCatalog(catalogName, config);

  // get
  catalog = await testClient.getCatalog(catalogName);
  expect(catalog.config.instructions).toStrictEqual(config.instructions);
  expect(catalog.config.description).toBe(config.description);

  // update
  config.description = "buzz 123";
  config.instructions = ["1", "2", "3"];
  catalog = await testClient.configureCatalog(catalogName, config);

  catalog = await testClient.getCatalog(catalogName);
  expect(catalog.config.instructions).toStrictEqual(config.instructions);
  expect(catalog.config.description).toBe(config.description);

  // get documentCount

  const docCount = await catalog.documentCount();
  expect(docCount).toBe(0);

  // list
  const catalogList = await testClient.listCatalogs();
  const catalogFromList = catalogList.find((c) => c.name === catalogName);
  expect(catalogFromList).toBeDefined();
  expect(catalogFromList?.documentCount).toBe(0);
  expect(catalogFromList?.description).toBe(config.description);
  // get catalog from list result
  const getCatalogFromList = await catalogFromList?.Catalog();
  expect(getCatalogFromList?.config.instructions).toStrictEqual(
    config.instructions,
  );

  // delete
  await catalog.delete();
  catalog = undefined;

  // assert that the get fails
  await expect(async () => {
    await testClient.getCatalog(catalogName);
  }).rejects.toThrowError("Failed to get catalog: Not Found");
});

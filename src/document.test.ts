import { afterEach, beforeEach, expect, test } from "vitest";
import { CatalogConfig } from "./catalog";
import { FileDocument, JSONDocument, TextDocument } from "./document";
import { testClient } from "./vitest-test-client";
import { Catalog } from "./catalog";

let catalog: Catalog;

beforeEach(async () => {
  const catalogName = `catalog-sdk-test-${Date.now()}`;

  const config: CatalogConfig = {
    description: "foo bar",
    instructions: ["a", "b"],
  };

  catalog = await testClient.configureCatalog(catalogName, config);
}, 20000);

afterEach(async () => {
  if (catalog) {
    await catalog.delete();
  }
}, 20000);

test("Test upsertDocuments inline text batch", { timeout: 60000 }, async () => {
  const docs: TextDocument[] = [
    {
      documentId: "1",
      contentType: "markdown",
      content: "# some markdown",
      url: "https://foo.com",
      imageUrl: "https://foo.com/image.jpg",
    },
    {
      documentId: "2",
      contentType: "markdown",
      content: "# some more markdown",
      url: "https://foo.com/2",
      imageUrl: "https://foo.com/image2.jpg",
    },
  ];

  await catalog.upsertDocuments(docs);

  const docCount = await catalog.documentCount();
  expect(docCount).toBe(2);
});

test("Test upsertDocuments inline JSON batch", { timeout: 60000 }, async () => {
  const docs: JSONDocument[] = [
    {
      documentId: "1",
      contentType: "json",
      content: {
        foo: "buzz",
        a: [5, 6, 7],
      },
      url: "https://foo.com",
      imageUrl: "https://foo.com/image.jpg",
    },
    {
      documentId: "2",
      contentType: "json",
      content: {
        foo: "bar",
        a: [1, 2, 3],
      },
      url: "https://foo.com/2",
      imageUrl: "https://foo.com/image2.jpg",
    },
  ];

  await catalog.upsertDocuments(docs);

  const docCount = await catalog.documentCount();
  expect(docCount).toBe(2);
});

test(
  "Test upsertDocuments with files and catalog.truncate",
  { timeout: 60000 },
  async () => {
    const docs: FileDocument[] = [
      {
        documentId: "1",
        contentType: "file",
        filePath: "./src/test_data/large_markdown_with_code.mdx",
        url: "https://foo.com",
        imageUrl: "https://foo.com/image.jpg",
      },
      {
        documentId: "2",
        contentType: "file",
        filePath: "./src/test_data/test_large_docx_file.docx",
        url: "https://foo.com/2",
        imageUrl: "https://foo.com/image2.jpg",
      },
    ];

    await catalog.upsertDocuments(docs);

    let docCount = await catalog.documentCount();
    expect(docCount).toBe(2);

    await catalog.truncate();

    docCount = await catalog.documentCount();
    expect(docCount).toBe(0);
  },
);

test("Test update documents", { timeout: 60000 }, async () => {
  const docs: TextDocument[] = [
    {
      documentId: "1",
      contentType: "markdown",
      content: "# some markdown",
      url: "https://foo.com",
      imageUrl: "https://foo.com/image.jpg",
    },
    {
      documentId: "2",
      contentType: "markdown",
      content: "# some more markdown",
      url: "https://foo.com/2",
      imageUrl: "https://foo.com/image2.jpg",
    },
  ];

  await catalog.upsertDocuments(docs);

  let docCount = await catalog.documentCount();
  expect(docCount).toBe(2);

  const doc = await catalog.getDocument("1");
  expect(doc.content).toBe("# some markdown");
  expect(doc.contentType).toBe("markdown");
  expect(doc.url).toBe("https://foo.com");
  expect(doc.imageUrl).toBe("https://foo.com/image.jpg");

  await catalog.upsertDocuments(docs);

  docCount = await catalog.documentCount();
  expect(docCount).toBe(2);
});

test("Test get and delete documents", { timeout: 60000 }, async () => {
  const docs: TextDocument[] = [
    {
      documentId: "1",
      contentType: "markdown",
      content: "# some markdown",
      url: "https://foo.com",
      imageUrl: "https://foo.com/image.jpg",
    },
    {
      documentId: "2",
      contentType: "markdown",
      content: "# some more markdown",
      url: "https://foo.com/2",
      imageUrl: "https://foo.com/image2.jpg",
    },
  ];

  await catalog.upsertDocuments(docs);

  let docCount = await catalog.documentCount();
  expect(docCount).toBe(2);

  const doc = await catalog.getDocument("1");
  expect(doc.content).toBe("# some markdown");
  expect(doc.contentType).toBe("markdown");
  expect(doc.url).toBe("https://foo.com");
  expect(doc.imageUrl).toBe("https://foo.com/image.jpg");

  await catalog.upsertDocuments(docs);

  await doc.delete();

  docCount = await catalog.documentCount();
  expect(docCount).toBe(1);
});

test("Test catalog.listDocuments", { timeout: 60000 }, async () => {
  const docs: JSONDocument[] = [];

  for (let i = 0; i < 70; i++) {
    docs.push({
      documentId: `${i}`,
      contentType: "json",
      content: {
        foo: "buzz",
        a: [5, 6, 7],
      },
      url: "https://foo.com",
      imageUrl: "https://foo.com/image.jpg",
    });
  }

  await catalog.upsertDocuments(docs);

  const docCount = await catalog.documentCount();
  expect(docCount).toBe(70);

  // paginate with default page size
  let listDocsResult = await catalog.listDocuments();
  expect(listDocsResult.documents.length).toBe(50);
  listDocsResult = await listDocsResult.nextPage();
  expect(listDocsResult.documents.length).toBe(20);
  listDocsResult = await listDocsResult.nextPage();
  expect(listDocsResult.documents.length).toBe(0);

  // paginate with page size: 70
  listDocsResult = await catalog.listDocuments({ page: 1, pageSize: 70 });
  expect(listDocsResult.documents.length).toBe(70);
  listDocsResult = await listDocsResult.nextPage();
  expect(listDocsResult.documents.length).toBe(0);
});

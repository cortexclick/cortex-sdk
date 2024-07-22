import { expect, test } from "vitest";
import { ContentStatus, TextDocument } from "./index";
import { CatalogConfig } from "./catalog";
import { testClient } from "./vitest-test-client";
import { Readable } from "stream";

test(
  "e2e catalog, cortex, and sync content generation workflow",
  { timeout: 180000 },
  async () => {
    const catalogName = `catalog-${Math.floor(Math.random() * 10000)}`;

    const config: CatalogConfig = {
      description:
        "this catalog contains documentation from the cortex click marketing website",
      instructions: [
        "user this data set to answer user questions about the cortex click platform",
      ],
    };

    // create
    const catalog = await testClient.configureCatalog(catalogName, config);

    const documents: TextDocument[] = [
      {
        documentId: "a",
        content:
          "cortex click solutions: customer support, blog and content writing, technical documentation generation, SEO, sales process automation, AI email marketing",
        contentType: "markdown",
      },
      {
        documentId: "b",
        content: "cortex click customers: reds fly shop, pyxos, ",
        contentType: "markdown",
      },
      {
        documentId: "c",
        content:
          "cortex click customer verticals and industries: developer tools, e-commerce, SaaS, network security, compliance, and more.",
        contentType: "markdown",
      },
    ];

    await catalog.upsertDocuments(documents);

    const cortex = await testClient.configureCortex(
      `cortex-${Math.floor(Math.random() * 10000)}`,
      {
        catalogs: [catalog.name],
        friendlyName: "Cortex AI",
        instructions: [
          "answer questions about the cortex click AI GTM platform",
        ],
        public: true,
      },
    );

    // create content
    const title = "Overview of the Cortex Click AI GTM Platform";
    const prompt =
      "Write a blog post about the Cortex Click AI GTM Platform. Elaborate on scenarios, customers, and appropriate verticals. Make sure to mention the impact that AI can have on sales and marketing teams.";
    const content = await cortex.generateContent({ title, prompt });
    const originalContent = content.content;
    const originalTitle = content.title;
    expect(content.content.length).toBeGreaterThan(1);
    expect(content.title).toBe(title);
    expect(content.version).toBe(0);
    expect(content.commands.length).toBe(1);
    expect(content.status).toBe(ContentStatus.Draft);
    expect(content.publishedVersion).toBe(undefined);

    // check that prompt that is too large will fail gracefully without hitting the service
    const hugePrompt = "p".repeat(32 * 1000 * 1000);
    await expect(() =>
      cortex.generateContent({ title, prompt: hugePrompt }),
    ).rejects.toThrow("Request body too large");

    // get content
    const getContent = await testClient.getContent(content.id);
    expect(getContent.content.length).toBe(content.content.length);
    expect(getContent.title).toBe(title);
    expect(getContent.version).toBe(0);
    expect(getContent.commands.length).toBe(1);
    expect(getContent.status).toBe(ContentStatus.Draft);
    expect(getContent.publishedVersion).toBe(undefined);

    // edit content
    const editedContent = await content.edit({ title: "foo", content: "bar" });
    expect(editedContent.content).toBe("bar");
    expect(editedContent.title).toBe("foo");
    expect(editedContent.version).toBe(1);
    expect(editedContent.commands.length).toBe(2);
    expect(editedContent.status).toBe(ContentStatus.Draft);
    expect(editedContent.publishedVersion).toBe(undefined);

    // get content version
    const contentV0 = await testClient.getContent(content.id, 0);
    expect(contentV0.content).toEqual(originalContent);
    expect(contentV0.title).toBe(originalTitle);
    expect(contentV0.version).toBe(0);
    expect(contentV0.commands.length).toBe(1);
    expect(contentV0.status).toBe(ContentStatus.Draft);
    expect(contentV0.publishedVersion).toBe(undefined);

    // revert to earlier version
    const revertedContent = await contentV0.revert(0);
    expect(revertedContent.content).toEqual(originalContent);
    expect(revertedContent.title).toBe(originalTitle);
    expect(revertedContent.version).toBe(2);
    expect(revertedContent.commands.length).toBe(3);
    expect(revertedContent.status).toBe(ContentStatus.Draft);
    expect(revertedContent.publishedVersion).toBe(undefined);

    const refinePrompt =
      "add a final paragraph with a joke or pun about cortex click an AI.";

    const refinedContent = await revertedContent.refine({
      prompt: refinePrompt,
    });
    expect(refinedContent.content.length).toBeGreaterThan(1);
    expect(refinedContent.title).toBe(originalTitle);
    expect(refinedContent.version).toBe(3);
    expect(refinedContent.commands.length).toBe(4);
    expect(refinedContent.status).toBe(ContentStatus.Draft);
    expect(refinedContent.publishedVersion).toBe(undefined);

    // list content - putting test here to save overhead of generating more content

    const contentList = await testClient.listContent({ pageSize: 1 });
    expect(contentList.content.length).toBe(1);

    const nextPage = await contentList.nextPage();
    expect(nextPage.content.length).toBe(1);

    const contentList2 = await testClient.listContent();
    expect(contentList2.content.length).toBeGreaterThan(1);

    // delete
    await catalog.delete();
  },
);

test("test streaming content", { timeout: 180000 }, async () => {
  const catalogName = `catalog-${Math.floor(Math.random() * 10000)}`;

  const config: CatalogConfig = {
    description:
      "this catalog contains documentation from the cortex click marketing website",
    instructions: [
      "user this data set to answer user questions about the cortex click platform",
    ],
  };

  // create
  const catalog = await testClient.configureCatalog(catalogName, config);

  const documents: TextDocument[] = [
    {
      documentId: "a",
      content:
        "cortex click solutions: customer support, blog and content writing, technical documentation generation, SEO, sales process automation, AI email marketing",
      contentType: "markdown",
    },
    {
      documentId: "b",
      content: "cortex click customers: reds fly shop, pyxos, ",
      contentType: "markdown",
    },
    {
      documentId: "c",
      content:
        "cortex click customer verticals and industries: developer tools, e-commerce, SaaS, network security, compliance, and more.",
      contentType: "markdown",
    },
  ];

  await catalog.upsertDocuments(documents);

  const cortex = await testClient.configureCortex(
    `cortex-${Math.floor(Math.random() * 10000)}`,
    {
      catalogs: [catalog.name],
      friendlyName: "Cortex AI",
      instructions: ["answer questions about the cortex click AI GTM platform"],
      public: true,
    },
  );

  // create content
  const title = "Overview of the Cortex Click AI GTM Platform";
  const prompt =
    "Write a blog post about the Cortex Click AI GTM Platform. Elaborate on scenarios, customers, and appropriate verticals. Make sure to mention the impact that AI can have on sales and marketing teams.";
  const statusStream = new Readable({
    read() {},
  });
  const { content, contentStream } = await testClient.generateContent({
    cortex,
    prompt,
    title,
    stream: true,
    statusStream,
  });
  let fullContent = "";
  contentStream.on("data", (data) => {
    fullContent += data.toString();
  });

  let sawPlan = false;
  let sawDraft = false;
  let sawEditorial = false;

  statusStream.on("data", (data) => {
    const message = JSON.parse(data);
    expect(message.messageType).toBe("status");
    switch (message.step) {
      case "plan":
        sawPlan = true;
        break;
      case "first-draft":
        sawDraft = true;
        break;
      case "editorial":
        sawEditorial = true;
        break;
      default:
        break;
    }
  });

  const contentResult = await content;
  expect(fullContent).toBe(contentResult.content);
  expect(contentResult.title).toBe(title);
  expect(contentResult.version).toBe(0);
  expect(contentResult.commands.length).toBe(1);
  expect(sawPlan).toBe(true);
  expect(sawDraft).toBe(true);
  expect(sawEditorial).toBe(true);
  expect(contentResult.status).toBe(ContentStatus.Draft);
  expect(contentResult.publishedVersion).toBe(undefined);

  const refinePrompt =
    "add a final paragraph with a joke or pun about cortex click an AI.";

  const refinedContentPromise = await contentResult.refine({
    prompt: refinePrompt,
    stream: true,
  });
  let fullRefinedContent = "";
  refinedContentPromise.contentStream.on("data", (data) => {
    fullRefinedContent += data.toString();
  });

  const refinedContent = await refinedContentPromise.content;

  expect(fullRefinedContent).toBe(refinedContent.content);
  expect(refinedContent.title).toBe(title);
  expect(refinedContent.version).toBe(1);
  expect(refinedContent.commands.length).toBe(2);
  expect(refinedContent.status).toBe(ContentStatus.Draft);
  expect(refinedContent.publishedVersion).toBe(undefined);

  await catalog.delete();
});

test(`test content status and publishing`, { timeout: 180000 }, async () => {
  const cortex = await testClient.configureCortex(
    `cortex-${Math.floor(Math.random() * 10000)}`,
    {
      friendlyName: "Cortex AI",
      instructions: ["answer questions about the cortex click AI GTM platform"],
      public: true,
    },
  );

  // create content
  const title = "Overview of the Cortex Click AI GTM Platform";
  const prompt =
    "Write a blog post about the Cortex Click AI GTM Platform. Elaborate on scenarios, customers, and appropriate verticals. Make sure to mention the impact that AI can have on sales and marketing teams.";
  const content = await cortex.generateContent({ title, prompt });

  expect(content.status).toBe(ContentStatus.Draft);

  const draftContent = await testClient.listContent({
    cortexName: cortex.name,
    status: ContentStatus.Draft,
  });
  expect(draftContent.content.length).toBe(1);

  await content.setStatus(ContentStatus.InReview);

  expect(content.status).toBe(ContentStatus.InReview);

  const inReviewContent = await testClient.listContent({
    cortexName: cortex.name,
    status: ContentStatus.InReview,
  });
  expect(inReviewContent.content.length).toBe(0);

  await content.setStatus(ContentStatus.Approved);

  expect(content.status).toBe(ContentStatus.Approved);

  const approvedContent = await testClient.listContent({
    cortexName: cortex.name,
    status: ContentStatus.Approved,
  });
  expect(approvedContent.content.length).toBe(1);

  await content.publish();

  expect(content.status).toBe(ContentStatus.Published);
  expect(content.publishedVersion).toBe(0);

  const publishedContent = await testClient.listContent({
    cortexName: cortex.name,
    status: ContentStatus.Published,
  });
  expect(publishedContent.content.length).toBe(1);

  await content.unpublish();
  expect(content.status).toBe(ContentStatus.Draft);
  expect(content.publishedVersion).toBe(undefined);

  const publishedContent2 = await testClient.listContent({
    cortexName: cortex.name,
    status: ContentStatus.Published,
  });
  expect(publishedContent2.content.length).toBe(0);

  await content.publish();
  expect(content.status).toBe(ContentStatus.Published);
  expect(content.publishedVersion).toBe(0);

  await cortex.delete();
});

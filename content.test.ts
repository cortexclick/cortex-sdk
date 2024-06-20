import { expect, test } from 'vitest';
import { CortexClient, TextDocument } from "./index";
import { CatalogConfig } from "./catalog";
import { Readable } from "stream";

const client = new CortexClient({
  accessToken: process.env.CORTEX_ACCESS_TOKEN || "",
  org: "cortex-click-test",
  apiUrl: "http://localhost:3001",
});


test('e2e catalog, cortex, and sync content generation workflow', {timeout: 120000}, async () => {

  client.configureOrg({
    companyName: "Cortex Click",
    companyInfo: "Cortex Click provides an AI platform for go-to-market. Cortex click allows you to index your enterprise knowledge base, and create agents called Cortexes that automate sales and marketing processes like SEO, content writing, RFP generation, customer support, sales document genearation such as security questionairres and more.",
    personality: [ "friendly and helpful", "expert sales and marketing professional", "experienced software developer"],
    rules: ["never say anything disparaging about AI or LLMs", "do not offer discounts"],
  })

  const catalogName = `catalog-${Math.floor(Math.random() * 10000)}`

  const config: CatalogConfig = {
    description: "this catalog contains documentation from the cortex click marketing website",
    instructions: [ "user this data set to answer user questions about the cortex click platform" ]
  };

  // create
  const catalog = await client.configureCatalog(catalogName, config);

  const documents: TextDocument[] = [
    {
      documentId: "a",
      content: "cortex click solutions: customer support, blog and content writing, technical documentation generation, SEO, sales process automation, AI email marketing",
      contentType: "markdown"
    },
    {
      documentId: "b",
      content: "cortex click customers: reds fly shop, pyxos, ",
      contentType: "markdown"
    },
    {
      documentId: "c",
      content: "cortex click customer verticals and industries: developer tools, e-commerce, SaaS, network security, compliance, and more.",
      contentType: "markdown"
    }
  ];

  await catalog.upsertDocuments(documents);

  const cortex = await client.configureCortex(`cortex-${Math.floor(Math.random() * 10000)}`, {
    catalogs: [ catalog.name ],
    friendlyName: "Cortex AI",
    instructions: [ "answer questions about the cortex click AI GTM platform"],
    public: true,
  });

  // create content
  const title = "Overview of the Cortex Click AI GTM Platform";
  const prompt = "Write a blog post about the Cortex Click AI GTM Platform. Elaborate on scenarios, customers, and appropriate verticals. Make sure to mention the impact that AI can have on sales and marketing teams."
  const content = await cortex.generateContent({title, prompt});
  const originalContent = content.content;
  const originalTitle = content.title;
  expect(content.content.length).toBeGreaterThan(1);
  expect(content.title).toBe(title);
  expect(content.version).toBe(0);
  expect(content.commands.length).toBe(1);

  // get content
  const getContent = await client.getContent(content.id);
  expect(getContent.content.length).toBe(content.content.length);
  expect(getContent.title).toBe(title);
  expect(getContent.version).toBe(0);
  expect(getContent.commands.length).toBe(1);

  // edit content
  const editedContent = await content.edit({title: "foo", content: "bar"});
  expect(editedContent.content).toBe("bar");
  expect(editedContent.title).toBe("foo");
  expect(editedContent.version).toBe(1);
  expect(editedContent.commands.length).toBe(2);

  // get content version
  const contentV0 = await client.getContent(content.id, 0);
  expect(contentV0.content).toEqual(originalContent);
  expect(contentV0.title).toBe(originalTitle);
  expect(contentV0.version).toBe(0);
  expect(contentV0.commands.length).toBe(1);

  // revert to earlier version
  const revertedContent = await contentV0.revert(0);
  expect(revertedContent.content).toEqual(originalContent);
  expect(revertedContent.title).toBe(originalTitle);
  expect(revertedContent.version).toBe(2);
  expect(revertedContent.commands.length).toBe(3);

  const refinePrompt = "add a final paragraph with a joke or pun about cortex click an AI."

  const refinedContent = await revertedContent.refine({ prompt: refinePrompt });
  expect(refinedContent.content.length).toBeGreaterThan(1);
  expect(refinedContent.title).toBe(originalTitle);
  expect(refinedContent.version).toBe(3);
  expect(refinedContent.commands.length).toBe(4);

  // delete 
  await catalog.delete();
});

test('test streaming content', {timeout: 120000}, async () => {

  client.configureOrg({
    companyName: "Cortex Click",
    companyInfo: "Cortex Click provides an AI platform for go-to-market. Cortex click allows you to index your enterprise knowledge base, and create agents called Cortexes that automate sales and marketing processes like SEO, content writing, RFP generation, customer support, sales document genearation such as security questionairres and more.",
    personality: [ "friendly and helpful", "expert sales and marketing professional", "experienced software developer"],
    rules: ["never say anything disparaging about AI or LLMs", "do not offer discounts"],
  })

  const catalogName = `catalog-${Math.floor(Math.random() * 10000)}`

  const config: CatalogConfig = {
    description: "this catalog contains documentation from the cortex click marketing website",
    instructions: [ "user this data set to answer user questions about the cortex click platform" ]
  };

  // create
  const catalog = await client.configureCatalog(catalogName, config);

  const documents: TextDocument[] = [
    {
      documentId: "a",
      content: "cortex click solutions: customer support, blog and content writing, technical documentation generation, SEO, sales process automation, AI email marketing",
      contentType: "markdown"
    },
    {
      documentId: "b",
      content: "cortex click customers: reds fly shop, pyxos, ",
      contentType: "markdown"
    },
    {
      documentId: "c",
      content: "cortex click customer verticals and industries: developer tools, e-commerce, SaaS, network security, compliance, and more.",
      contentType: "markdown"
    }
  ];

  await catalog.upsertDocuments(documents);

  const cortex = await client.configureCortex(`cortex-${Math.floor(Math.random() * 10000)}`, {
    catalogs: [ catalog.name ],
    friendlyName: "Cortex AI",
    instructions: [ "answer questions about the cortex click AI GTM platform"],
    public: true,
  });

  // create content
  const title = "Overview of the Cortex Click AI GTM Platform";
  const prompt = "Write a blog post about the Cortex Click AI GTM Platform. Elaborate on scenarios, customers, and appropriate verticals. Make sure to mention the impact that AI can have on sales and marketing teams."
  const statusStream = new Readable({
    read() { }
  });
  const { content, contentStream } = await client.generateContent({ cortex, prompt, title, stream: true, statusStream});
  let fullContent = ""
  contentStream.on('data', (data) => {
    fullContent += data.toString();
  });

  let sawPlan = false;
  let sawDraft = false;
  let sawEditorial = false

  statusStream.on('data', (data) => {
    const message = JSON.parse(data);
    expect(message.messageType).toBe("status");
    switch(message.step) {
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

  const refinePrompt = "add a final paragraph with a joke or pun about cortex click an AI."

  const refinedContentPromise = await contentResult.refine({ prompt: refinePrompt, stream: true });
  let fullRefinedContent = "";
  refinedContentPromise.contentStream.on('data', (data)=> {
    fullRefinedContent += data.toString();
  });

  const refinedContent = await refinedContentPromise.content;

  expect(fullRefinedContent).toBe(refinedContent.content);
  expect(refinedContent.title).toBe(title);
  expect(refinedContent.version).toBe(1);
  expect(refinedContent.commands.length).toBe(2);

  await catalog.delete();
});

test('e2e content without any catalogs', { timeout: 120000 }, async () => {
  client.configureOrg({
    companyName: "Cortex Click",
    companyInfo: "Cortex Click provides an AI platform for go-to-market. Cortex click allows you to index your enterprise knowledge base, and create agents called Cortexes that automate sales and marketing processes like SEO, content writing, RFP generation, customer support, sales document genearation such as security questionairres and more.",
    personality: [ "friendly and helpful", "expert sales and marketing professional", "experienced software developer"],
    rules: ["never say anything disparaging about AI or LLMs", "do not offer discounts"],
  })

  const cortex = await client.configureCortex(`cortex-${Math.floor(Math.random() * 10000)}`, {
    friendlyName: "Cortex AI",
    instructions: [ "answer questions about the cortex click AI GTM platform"],
    public: true,
  });

  // create content
  const title = "Overview of the Cortex Click AI GTM Platform";
  const prompt = "Write a blog post about the Cortex Click AI GTM Platform. Elaborate on scenarios, customers, and appropriate verticals. Make sure to mention the impact that AI can have on sales and marketing teams."
  const content = await cortex.generateContent({ title, prompt });

  expect(content.content.length).toBeGreaterThan(1);
  expect(content.title).toBe(title);
  expect(content.version).toBe(0);
  expect(content.commands.length).toBe(1);
});

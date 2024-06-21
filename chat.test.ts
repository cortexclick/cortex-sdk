import { expect, test } from "vitest";
import { TextDocument } from "./index";
import { CatalogConfig } from "./catalog";
import { testClient } from "./vitest-test-client";
import { Readable } from "stream";

test("e2e catalog, cortex, and sync chat", { timeout: 60000 }, async () => {
  testClient.configureOrg({
    companyName: "Cortex Click",
    companyInfo:
      "Cortex Click provides an AI platform for go-to-market. Cortex click allows you to index your enterprise knowledge base, and create agents called Cortexes that automate sales and marketing processes like SEO, content writing, RFP generation, customer support, sales document genearation such as security questionairres and more.",
    personality: [
      "friendly and helpful",
      "expert sales and marketing professional",
      "experienced software developer",
    ],
    rules: [
      "never say anything disparaging about AI or LLMs",
      "do not offer discounts",
    ],
  });

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

  // create chat
  const chatInput = "what customers does cortex click have?";
  const chat = await cortex.chat({ message: chatInput });
  expect(chat.messages[1].message.length).toBeGreaterThan(0);

  // get chat
  const getChatRes = await testClient.getChat(chat.id);
  expect(getChatRes.messages.length).toBe(2);
  expect(getChatRes.title).toBe(chatInput);

  // respond to chat
  await chat.respond({ message: "what about customer verticals" });
  expect(chat.messages.length).toBe(4);

  // list chats
  const chatList = await testClient.listChats({ pageSize: 1 });
  expect(chatList.chats.length).toBe(1);

  const nextPage = await chatList.nextPage();
  expect(nextPage.chats.length).toBe(1);
  expect(nextPage.chats[0].id).not.toBe(chat.id);

  // delete
  await catalog.delete();
});

test("streaming chat", { timeout: 60000 }, async () => {
  testClient.configureOrg({
    companyName: "Cortex Click",
    companyInfo:
      "Cortex Click provides an AI platform for go-to-market. Cortex click allows you to index your enterprise knowledge base, and create agents called Cortexes that automate sales and marketing processes like SEO, content writing, RFP generation, customer support, sales document genearation such as security questionairres and more.",
    personality: [
      "friendly and helpful",
      "expert sales and marketing professional",
      "experienced software developer",
    ],
    rules: [
      "never say anything disparaging about AI or LLMs",
      "do not offer discounts",
    ],
  });

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

  // create chat
  const chatInput = "what customers does cortex click have?";
  const statusStream = new Readable({
    read() {},
  });
  const { responseStream, chat } = await cortex.chat({
    message: chatInput,
    stream: true,
    statusStream,
  });

  let fullMessage = "";
  responseStream.on("data", (data) => {
    fullMessage += data.toString();
  });

  let sawChat = false;

  statusStream.on("data", (data) => {
    const message = JSON.parse(data);
    expect(message.messageType).toBe("status");
    switch (message.step) {
      case "chat":
        sawChat = true;
        break;
      default:
        break;
    }
  });

  const chatResult = await chat;

  expect(fullMessage).toBe(
    chatResult.messages[chatResult.messages.length - 1].message,
  );
  expect(chatResult.messages.length).toBe(2);
  expect(sawChat).toBe(true);

  // respond to chat
  const respondResult = await chatResult.respond({
    message: "what about customer verticals",
    stream: true,
    statusStream,
  });

  const respondStream = respondResult.responseStream;

  let fullResponse = "";
  respondStream.on("data", (data) => {
    fullResponse += data.toString();
  });

  const response = await respondResult.chat;
  expect(fullResponse).toBe(
    response.messages[response.messages.length - 1].message,
  );
  expect(response.messages.length).toBe(4);

  // delete
  await catalog.delete();
});

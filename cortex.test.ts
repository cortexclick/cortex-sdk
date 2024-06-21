import { expect, test } from "vitest";
import { OrgConfigOpts } from "./org";
import { CortexConfig } from "./cortex";

test("can get and set OrgConfig", async () => {
  const orgConfigOpts: OrgConfigOpts = {
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
  };

  await testClient.configureOrg(orgConfigOpts);

  const getOrgConfig = await testClient.getOrgConfig();
  expect(getOrgConfig.companyName).toBe(orgConfigOpts.companyName);
  expect(getOrgConfig.companyInfo).toBe(orgConfigOpts.companyInfo);
});

test("can configure, get, and delete and Cortexes", async () => {
  const cortexName = `cortex-${Math.floor(Math.random() * 10000)}`;

  const cortexConfig: CortexConfig = {
    friendlyName: "Cortex AI",
    catalogs: ["cat-1", "cat-2"],
    instructions: ["do your job", "do it well"],
    public: false,
    customizations: {
      rules: ["be nice to the user"],
      personality: ["saucy"],
      chatVerbosity: "concise",
      writeVerbosity: "long-form",
    },
    chatConfig: {
      intro: "hello world",
      examples: ["q1", "q2"],
      greeting: "who lives in a pineapple under the sea? CORTEX AI.",
    },
    overrides: {
      companyInfo: "a very good company that does AI stuff",
      companyName: "Cortex Click, Inc. --test",
      inheritRules: false,
    },
  };

  let cortex = await testClient.configureCortex(cortexName, cortexConfig);

  cortex = await testClient.getCortex(cortexName);
  expect(cortex.config.catalogs).toStrictEqual(cortexConfig.catalogs);
  // TODO - check all the properties

  // delete the cortex
  await cortex.delete();
  // assert that the get failes
  await expect(async () => {
    await testClient.getCortex(cortexName);
  }).rejects.toThrowError("Failed to get cortex: Not Found");
});

import { beforeAll } from "vitest";
import { testClient } from "./vitest-test-client";

beforeAll(() => {
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
});

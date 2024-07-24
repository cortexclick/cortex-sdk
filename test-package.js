import { CortexClient } from "./dist/index.js";

export const testClient = new CortexClient({
  accessToken: process.env.CORTEX_ACCESS_TOKEN,
  org: process.env.CORTEX_ORG,
  apiUrl: process.env.CORTEX_API_URL || "https://api.cortexclick.com",
});

console.info(await testClient.listContent({ pageSize: 1 }));

import { CortexClient, CortexApiClient } from "./index";

if (!process.env.CORTEX_ACCESS_TOKEN) {
  throw new Error("$CORTEX_ACCESS_TOKEN must be set to run tests");
}
if (!process.env.CORTEX_ORG) {
  throw new Error("$CORTEX_ORG must be set to run tests");
}
export const testClient = new CortexClient({
  accessToken: process.env!.CORTEX_ACCESS_TOKEN,
  org: process.env!.CORTEX_ORG,
  apiUrl: process.env.CORTEX_API_URL || "https://api.cortexclick.com",
});

export const testApiClient = new CortexApiClient(
  process.env!.CORTEX_ORG, 
  process.env.CORTEX_API_URL || "https://api.cortexclick.com",
  process.env!.CORTEX_ACCESS_TOKEN,
);



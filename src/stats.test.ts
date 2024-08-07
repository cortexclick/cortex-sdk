import { expect, test } from "vitest";

import { testApiClient } from "./vitest-test-client";

test(
  "Test stats",
  { timeout: 10000 },
  async () => {
    const response = await testApiClient.GET("/stats");
    expect(response.status).toBe(200);
  });
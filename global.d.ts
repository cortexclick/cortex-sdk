// global.d.ts
import { CortexClient } from "./index";

declare global {
  // eslint-disable-next-line no-var
  var testClient: CortexClient;
}

export {};

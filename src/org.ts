import { CortexApiClient } from "./api-client";

export type OrgConfigOpts = {
  companyName: string;
  companyInfo: string;
  personality?: string[];
  rules?: string[];
};

export class OrgConfig {
  /**
   * The default name that all your company should be referred to in all writen content.
   */
  readonly companyName: string;
  /**
   * A description of your company, industry, and products and services provided.
   */
  readonly companyInfo: string;
  /**
   * Voice and tone descriptors applied to all written content. i.e. ["concise", "professional", "bubbly", ... ]
   */
  readonly personality?: string[];
  /**
   * A list of dos and don'ts that all written content should follow. i.e. ["do not speak disparigingly about X"]
   */
  readonly rules?: string[];
  private constructor(input: OrgConfigOpts) {
    this.companyName = input.companyName;
    this.companyInfo = input.companyInfo;
    this.personality = input.personality;
    this.rules = input.rules;
  }

  static async get(client: CortexApiClient): Promise<OrgConfig> {
    const res = await client.GET("/org-config");
    if (res.status !== 200) {
      throw new Error(`Failed to configure cortex: ${res.statusText}`);
    }
    const body = await res.json();
    const input: OrgConfigOpts = {
      companyName: body.companyName,
      companyInfo: body.companyInfo,
      personality: body.personality,
      rules: body.rules,
    };
    return new OrgConfig(input);
  }

  static async configure(
    client: CortexApiClient,
    config: OrgConfigOpts,
  ): Promise<OrgConfig> {
    const getRes = await client.GET("/org-config");
    let res: Response;
    if (getRes.status !== 200) {
      res = await client.POST("/org-config", config);
    } else {
      res = await client.PUT("/org-config", config);
    }

    if (res.status > 201) {
      throw new Error(`Failed to configure org: ${res.statusText}`);
    }

    return new OrgConfig(config);
  }
}

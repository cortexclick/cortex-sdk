import { Readable } from "stream";
import { CortexApiClient } from "./api-client";
import { Cortex } from "./cortex";
import { processStream } from "./utils/streaming";

export type ContentCommandType =
  | "ai-generate"
  | "ai-refine"
  | "ai-regenerate"
  | "user-edit"
  | "revert";

export const ContentStatus = {
  Draft: "DRAFT" as const,
  InReview: "IN_REVIEW" as const,
  Approved: "APPROVED" as const,
  Published: "PUBLISHED" as const,
};
export type ContentStatus = (typeof ContentStatus)[keyof typeof ContentStatus];
export type SettableContentStatus = "DRAFT" | "IN_REVIEW" | "APPROVED";

export interface CreateContentOptsBase {
  client: CortexApiClient;
  cortex: Cortex;
  title: string;
  prompt: string;
  stream?: boolean;
  statusStream?: Readable;
}

export interface CreateContentOptsStreaming extends CreateContentOptsBase {
  stream?: true;
}

export interface CreateContentOptsSync extends CreateContentOptsBase {
  stream?: false;
}

export interface RefineContentOptsBase {
  prompt: string;
  stream?: boolean;
  statusStream?: Readable;
}

export interface RefineContentOptsStreaming extends RefineContentOptsBase {
  stream?: true;
}

export interface RefineContentOptsSync extends RefineContentOptsBase {
  stream?: false;
}

export type StreamingContentResult = {
  readonly contentStream: Readable;
  readonly content: Promise<Content>;
};

type ContentCommand = {
  commandType: ContentCommandType;
  command?: string;
  version: number;
};

export type EditContentOpts = {
  title?: string;
  content?: string;
};

export type ContentListItem = {
  title: string;
  latestVersion: number;
  id: string;
  userEmail?: string;
  cortexName: string;
  createdAt: string;
  status: ContentStatus;
  publishedVersion?: number;
  Content(): Promise<Content>;
};

export type ContentListResult = {
  nextPage: () => Promise<ContentListResult>;
  content: ContentListItem[];
};
export type ContentListOptions = {
  cursor?: string;
  pageSize?: number;
  userEmail?: string | null;
  cortexName?: string;
  status?: ContentStatus;
};

export type ContentMetadata = {
  id: string;
  title: string;
  version: number;
  commands: ContentCommand[];
  cortex: string;
  createdAt: string;
  userEmail: string;
  status: ContentStatus;
  publishedVersion: number | null;
};

export type ContentPublishTarget = {
  id: string;
  name: string;
  type: "github_repo";
};

export type ContentFulfilledPublishTarget =
  | {
      id: string;
      name: string;
      type: "github_repo";
      path: string;
    }
  | { id: "none"; type: "none" };

export class Content {
  get id() {
    return this._id;
  }

  get title() {
    return this._title;
  }

  get content() {
    return this._content;
  }

  get commands() {
    return this._commands;
  }

  get version() {
    return this._version;
  }

  get cortex() {
    return this._cortex;
  }

  get userEmail() {
    return this._userEmail;
  }

  get createdAt() {
    return this._createdAt;
  }

  get status(): ContentStatus {
    return this._status;
  }

  get publishedVersion(): number | undefined {
    return this._publishedVersion;
  }

  private constructor(
    private apiClient: CortexApiClient,
    private _id: string,
    private _title: string,
    private _content: string,
    private _commands: ContentCommand[],
    private _version: number,
    private _createdAt: string,
    private _status: ContentStatus = "DRAFT",
    private _cortex?: string,
    private _userEmail?: string,
    private _publishedVersion?: number,
  ) {}

  static async create(opts: CreateContentOptsSync): Promise<Content>;
  static async create(
    opts: CreateContentOptsStreaming,
  ): Promise<StreamingContentResult>;
  static async create(
    opts: CreateContentOptsSync | CreateContentOptsStreaming,
  ): Promise<Content | StreamingContentResult> {
    // note: this if statement is annoying but is necessary to appropriately narrow the return type
    if (isCreateContentOptsSync(opts)) {
      return this.createContentSync(opts);
    } else {
      return this.createContentStreaming(opts);
    }
  }

  private static async createContentSync(
    opts: CreateContentOptsSync,
  ): Promise<Content> {
    const { client, cortex, title, prompt } = opts;
    const res = await client.POST(`/content`, {
      cortex: cortex.name,
      title,
      prompt,
    });
    const body = await res.json();

    return new Content(
      client,
      body.id,
      body.title,
      body.content,
      body.commands,
      body.version,
      body.createdAt,
      body.status,
      body.cortex,
      body.userEmail,
      numberOrUndefined(body.publishedVersion),
    );
  }

  private static async createContentStreaming(
    opts: CreateContentOptsStreaming,
  ): Promise<StreamingContentResult> {
    const { client, cortex, title, prompt, stream } = opts;
    const res = await client.POST(`/content`, {
      cortex: cortex.name,
      title,
      prompt,
      stream,
      noContentInHeaders: true,
    });
    const reader = res.body!.getReader();
    const decoder = new TextDecoder("utf-8");

    const readableStream = new Readable({
      read() {},
    });

    const contentPromise = processStream<ContentMetadata>(
      reader,
      decoder,
      readableStream,
      opts.statusStream,
    ).then(([content, metadata]) => {
      if (!metadata) {
        throw new Error("Metadata not found in stream");
      }

      return new Content(
        client,
        metadata.id,
        metadata.title,
        content,
        metadata.commands,
        metadata.version,
        metadata.createdAt,
        metadata.status,
        metadata.cortex,
        metadata.userEmail,
        metadata.publishedVersion || undefined,
      );
    });

    return { contentStream: readableStream, content: contentPromise };
  }

  static async get(
    client: CortexApiClient,
    id: string,
    version?: number,
  ): Promise<Content> {
    let res: Response;
    if (version !== undefined) {
      res = await client.GET(`/content/${id}/version/${version}`);
    } else {
      res = await client.GET(`/content/${id}`);
    }

    if (res.status !== 200) {
      throw new Error(`Failed to get content: ${res.statusText}`);
    }

    const body = await res.json();
    return new Content(
      client,
      id,
      body.title,
      body.content,
      body.commands,
      body.version,
      body.createdAt,
      body.status,
      body.cortex,
      body.userEmail,
      numberOrUndefined(body.publishedVersion),
    );
  }

  async edit(opts: EditContentOpts) {
    if (!opts.title && !opts.content) {
      throw new Error(
        "must specify one of opts.title or opts.content to edit content",
      );
    }

    const res = await this.apiClient.PUT(`/content/${this._id}`, opts);
    const body = await res.json();
    this.updateFromResponseBody(body);

    return this;
  }

  async refine(opts: RefineContentOptsSync): Promise<Content>;
  async refine(
    opts: RefineContentOptsStreaming,
  ): Promise<StreamingContentResult>;
  async refine(
    opts: RefineContentOptsSync | RefineContentOptsStreaming,
  ): Promise<Content | StreamingContentResult> {
    if (isRefineContentOptsSync(opts)) {
      return this.refineContentSync(opts);
    } else {
      return this.refineContentStreaming(opts);
    }
  }

  private async refineContentSync(
    opts: RefineContentOptsSync,
  ): Promise<Content> {
    const res = await this.apiClient.POST(`/content/${this._id}/refine`, {
      prompt: opts.prompt,
    });
    const body = await res.json();
    this.updateFromResponseBody(body);

    return this;
  }

  private async refineContentStreaming(
    opts: RefineContentOptsStreaming,
  ): Promise<StreamingContentResult> {
    const { prompt } = opts;
    const res = await this.apiClient.POST(`/content/${this._id}/refine`, {
      prompt,
      stream: true,
      noContentInHeaders: true,
    });
    const reader = res.body!.getReader();
    const decoder = new TextDecoder("utf-8");

    const readableStream = new Readable({
      read() {},
    });

    const contentPromise = processStream<ContentMetadata>(
      reader,
      decoder,
      readableStream,
      opts.statusStream,
    ).then(([content, metadata]) => {
      if (!metadata) {
        throw new Error("Metadata not found in stream");
      }

      this._content = content;
      this._version = metadata.version;
      this._commands = metadata.commands;
      this._createdAt = metadata.createdAt;
      this._userEmail = metadata.userEmail;
      this._status = metadata.status;
      this._publishedVersion = metadata.publishedVersion || undefined;
      this._title = metadata.title;
      return this;
    });

    return { contentStream: readableStream, content: contentPromise };
  }

  async revert(version: number) {
    const res = await this.apiClient.POST(
      `/content/${this._id}/version/${version}`,
    );

    if (res.status > 201) {
      throw new Error(`Failed to revert content: ${res.statusText}`);
    }

    const body = await res.json();
    this.updateFromResponseBody(body);

    return this;
  }

  async setStatus(status: SettableContentStatus) {
    const res = await this.apiClient.PUT(`/content/${this._id}/status`, {
      status,
    });

    if (res.status > 201) {
      throw new Error(`Failed to set content status: ${res.statusText}`);
    }

    const body = await res.json();
    this.updateFromResponseBody(body);

    return this;
  }

  async publish(
    publishTarget: ContentFulfilledPublishTarget = { id: "none", type: "none" },
  ) {
    const res = await this.apiClient.POST(`/content/${this._id}/publish`, {
      publishTarget,
    });

    if (res.status > 201) {
      throw new Error(`Failed to publish content: ${res.statusText}`);
    }

    const body = await res.json();
    this.updateFromResponseBody(body);

    return this;
  }

  async unpublish() {
    const res = await this.apiClient.POST(`/content/${this._id}/unpublish`);

    if (res.status > 201) {
      throw new Error(`Failed to unpublish content: ${res.statusText}`);
    }

    const body = await res.json();
    this.updateFromResponseBody(body);

    return this;
  }

  async getPublishTargets() {
    const res = await this.apiClient.GET(`/content/${this._id}/publishTargets`);

    if (res.status !== 200) {
      throw new Error(
        `Failed to get content publish targets: ${res.statusText}`,
      );
    }

    const result = (await res.json()) as { targets: ContentPublishTarget[] };
    return result.targets;
  }

  private updateFromResponseBody(body: Record<string, unknown>) {
    this._commands = body.commands as ContentCommand[];
    this._content = body.content as string;
    this._title = body.title as string;
    this._version = body.version as number;
    this._cortex = body.cortex as string;
    this._userEmail = body.userEmail as string | undefined;
    this._createdAt = body.createdAt as string;
    this._publishedVersion = numberOrUndefined(
      body.publishedVersion as string | undefined,
    );
    this._status = body.status as ContentStatus;
  }

  static async list(
    client: CortexApiClient,
    opts?: ContentListOptions,
  ): Promise<ContentListResult> {
    const contentList: ContentListItem[] = [];

    const query = new URLSearchParams();
    if (opts?.cursor) {
      query.set("cursor", opts.cursor);
    }
    if (opts?.userEmail) {
      query.set("userEmail", opts.userEmail);
    } else if (opts?.userEmail === null) {
      query.set("userEmail", "null");
    }
    if (opts?.cortexName) {
      query.set("cortexName", opts.cortexName);
    }
    if (opts?.status) {
      query.set("status", opts.status);
    }
    query.set("pageSize", (opts?.pageSize || 50).toString());
    const res = await client.GET(`/content?${query.toString()}`);
    if (res.status !== 200) {
      throw new Error(`Failed to list content: ${res.statusText}`);
    }
    const body = await res.json();
    for (const content of body.content) {
      contentList.push({
        title: content.title,
        latestVersion: content.latestVersion,
        id: content.contentId,
        userEmail: content.userEmail,
        cortexName: content.cortexName,
        createdAt: content.createdAt,
        status: content.status,
        publishedVersion: numberOrUndefined(content.publishedVersion),
        Content: () => Content.get(client, content.contentId),
      });
    }

    const newCursor = body.cursor;
    return {
      content: contentList,
      nextPage: async () =>
        Content.list(client, { ...opts, cursor: newCursor }),
    };
  }
}

function isCreateContentOptsSync(
  opts: CreateContentOptsSync | CreateContentOptsStreaming,
): opts is CreateContentOptsSync {
  return opts.stream === false || opts.stream === undefined;
}

function isRefineContentOptsSync(
  opts: RefineContentOptsSync | RefineContentOptsStreaming,
): opts is RefineContentOptsSync {
  return opts.stream === false || opts.stream === undefined;
}

// if a number (even 0), returns it
// if a string, parses it as an int, unless its an empty string, in which case returns undefined
// if undefined, returns undefined
function numberOrUndefined(
  val: number | string | undefined | null,
): number | undefined {
  switch (typeof val) {
    case "number":
      return val;
    case "string":
      return val === "" ? undefined : parseInt(val);
    default:
      return undefined;
  }
}

import { Cortex } from "./cortex.js";
import { CortexApiClient } from "./api-client.js";
import { Readable } from 'stream';
import { processStream } from "./utils/streaming.js";

export type ContentCommandType = "ai-generate" | "ai-refine" | "ai-regenerate" | "user-edit" | "revert";

export interface CreateContentOptsBase {
    client: CortexApiClient;
    cortex: Cortex;
    title: string;
    prompt: string;
    stream?: boolean;
    statusStream?: Readable;
}

export interface CreateContentOptsStreaming extends CreateContentOptsBase {
    stream?: true
}

export interface CreateContentOptsSync extends CreateContentOptsBase {
    stream?: false
}

export interface RefineContentOptsBase {
    prompt: string;
    stream?: boolean;
    statusStream?: Readable;
}

export interface RefineContentOptsStreaming extends RefineContentOptsBase {
    stream?: true
}

export interface RefineContentOptsSync extends RefineContentOptsBase {
    stream?: false
}

export type StreamingContentResult = {
    readonly contentStream: Readable;
    readonly content: Promise<Content>
}

type ContentCommand = {
    commandType: ContentCommandType;
    command?: string;
    version: number;
};

export type EditContentOpts = {
    title?: string;
    content?: string;
}

export type ContentListItem = {
    title: string;
    latestVersion: number;
    id: string;
    Content(): Promise<Content>;
}

export type ContentListResult = { nextPage: () => Promise<ContentListResult>, content: ContentListItem[] };
export type ContentListPaginationOptions = {
    cursor?: string;
    pageSize?: number;
}

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

    private constructor(private apiClient: CortexApiClient, private _id: string, private _title: string, private _content: string, private _commands: ContentCommand[], private _version: number, private _cortex?: string) {
    }


    static async create(opts: CreateContentOptsSync): Promise<Content>;
    static async create(opts: CreateContentOptsStreaming): Promise<StreamingContentResult>;
    static async create(opts: CreateContentOptsSync | CreateContentOptsStreaming): Promise<Content | StreamingContentResult> {
        // note: this if statement is annoying but is necessary to appropriately narrow the return type
        if (isCreateContentOptsSync(opts)) {
            return this.createContentSync(opts);
        } else {
            return this.createContentStreaming(opts);
        }

    }

    private static async createContentSync(opts: CreateContentOptsSync): Promise<Content> {
        const { client, cortex, title, prompt } = opts;
        const res = await client.POST(`/content`, { cortex: cortex.name, title, prompt });
        const body = await res.json();

        return new Content(client, body.id, body.title, body.content, body.commands, body.version);
    }

    private static async createContentStreaming(opts: CreateContentOptsStreaming): Promise<StreamingContentResult> {
        const { client, cortex, title, prompt, stream } = opts;
        const res = await client.POST(`/content`, { cortex: cortex.name, title, prompt, stream });
        const reader = res.body!.getReader();
        const decoder = new TextDecoder('utf-8');

        const id: string = res.headers.get("id") || "";
        const version: number = parseInt(res.headers.get("version") || "0");
        const commands: ContentCommand[] = JSON.parse(res.headers.get("commands") || "[]");

        const readableStream = new Readable({
            read() { }
        });

        const contentPromise = processStream(reader, decoder, readableStream, opts.statusStream).then(content => {
            return new Content(client, id, title, content, commands, version, cortex.name);
        });

        return { contentStream: readableStream, content: contentPromise };
    }

    static async get(client: CortexApiClient, id: string, version?: number): Promise<Content> {
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
        return new Content(client, id, body.title, body.content, body.commands, body.version, body.cortex);
    }

    async edit(opts: EditContentOpts) {
        if (!opts.title && !opts.content) {
            throw new Error("must specify one of opts.title or opts.content to edit content");
        }

        const res = await this.apiClient.PUT(`/content/${this._id}`, opts);
        const body = await res.json();

        this._commands = body.commands;
        this._content = body.content;
        this._title = body.title;
        this._version = body.version;
        this._cortex = body.cortex;

        return this;
    }

    async refine(opts: RefineContentOptsSync): Promise<Content>;
    async refine(opts: RefineContentOptsStreaming): Promise<StreamingContentResult>;
    async refine(opts: RefineContentOptsSync | RefineContentOptsStreaming): Promise<Content | StreamingContentResult> {
        if (isRefineContentOptsSync(opts)) {
            return this.refineContentSync(opts);
        } else {
            return this.refineContentStreaming(opts);
        }
    }

    private async refineContentSync(opts: RefineContentOptsSync): Promise<Content> {
        const res = await this.apiClient.POST(`/content/${this._id}/refine`, { prompt: opts.prompt });
        const body = await res.json();

        this._commands = body.commands;
        this._content = body.content;
        this._title = body.title;
        this._version = body.version;
        this._cortex = body.cortex;

        return this;
    }

    private async refineContentStreaming(opts: RefineContentOptsStreaming): Promise<StreamingContentResult> {
        const { prompt } = opts;
        const res = await this.apiClient.POST(`/content/${this._id}/refine`, { prompt, stream: true });
        const reader = res.body!.getReader();
        const decoder = new TextDecoder('utf-8');

        const version: number = parseInt(res.headers.get("version") || "0");
        const commands: ContentCommand[] = JSON.parse(res.headers.get("commands") || "[]");
        this._version = version;
        this._commands = commands;

        const readableStream = new Readable({
            read() { }
        });

        const contentPromise = processStream(reader, decoder, readableStream, opts.statusStream).then(content => {
            this._content = content;
            return this;
        });

        return { contentStream: readableStream, content: contentPromise };
    }

    async revert(version: number) {
        const res = await this.apiClient.POST(`/content/${this._id}/version/${version}`);

        if (res.status !== 200) {
            throw new Error(`Failed to revert content: ${res.statusText}`);
        }

        const body = await res.json();

        this._commands = body.commands;
        this._content = body.content;
        this._title = body.title;
        this._version = body.version;
        this._cortex = body.cortex;

        return this;
    }

    static async list(client: CortexApiClient, paginationOpts?: ContentListPaginationOptions): Promise<ContentListResult> {
        const content: ContentListItem[] = [];

        const query = new URLSearchParams();
        if (paginationOpts?.cursor) {
            query.set("cursor", paginationOpts.cursor);
        }
        query.set("pageSize", (paginationOpts?.pageSize || 50).toString());
        const res = await client.GET(`/content?${query.toString()}`);
        if (res.status !== 200) {
            throw new Error(`Failed to list content: ${res.statusText}`);
        }
        const body = await res.json();
        for (let content of body.content) {
            content.push({
                title: content.title,
                latestVersion: content.latestVersion,
                id: content.contentId,
                Content: () => { return Content.get(client, content.contentId) }
            })
        }

        const cursor = body.cursor;
        const pageSize = paginationOpts?.pageSize;
        return { content, nextPage: async () => { return Content.list(client, { cursor, pageSize }) } };
    }
}

function isCreateContentOptsSync(opts: CreateContentOptsSync | CreateContentOptsStreaming): opts is CreateContentOptsSync {
    return opts.stream === false || opts.stream === undefined;
}

function isRefineContentOptsSync(opts: RefineContentOptsSync | RefineContentOptsStreaming): opts is RefineContentOptsSync {
    return opts.stream === false || opts.stream === undefined;
}

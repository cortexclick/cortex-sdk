import { Cortex, CortexConfig } from "./cortex.js";
import { Catalog, CatalogConfig } from "./catalog.js";
import { OrgConfigOpts, OrgConfig } from "./org.js";
import { CortexApiClient } from "./api-client.js";
import { Chat, StreamingChatResult } from "./chat.js";
import { Content, StreamingContentResult } from "./content.js";
import { Readable } from "stream";

export type CortexClientArgs = {
    org: string;
    accessToken: string;
    apiUrl?: string;
}

export interface ClientCreateContentOptsBase {
    cortex: Cortex;
    title: string;
    prompt: string;
    stream?: boolean;
    statusStream?: Readable;
};
export interface ClientCreateContentOptsSync extends ClientCreateContentOptsBase {
    stream?: false;
};
export interface ClientCreateContentOptsStreaming extends ClientCreateContentOptsBase {
    stream?: true;
};

export interface ClientCreateChatOptsBase {
    message: string;
    cortex: Cortex;
    stream?: boolean;
    statusStream?: Readable;
}

export interface ClientCreateChatOptsStreaming extends ClientCreateChatOptsBase {
    stream?: true
}

export interface ClientCreateChatOptsSync extends ClientCreateChatOptsBase {
    stream?: false
}

export interface ClientListContentPaginationOpts {
    pageSize?: number;
    cursor?: string;
}

const apiUrl = process.env.CORTEX_API_URL || "https://api.cortexclick.com";

export class CortexClient {
    private apiClient: CortexApiClient;
    constructor(args: CortexClientArgs) {
        const url: string = args.apiUrl || apiUrl;
        this.apiClient = new CortexApiClient(args.org, url, args.accessToken)
    }

    async chat(opts: ClientCreateChatOptsSync): Promise<Chat>;
    async chat(opts: ClientCreateChatOptsStreaming): Promise<StreamingChatResult>;
    async chat(opts: ClientCreateChatOptsSync | ClientCreateChatOptsStreaming): Promise<Chat | StreamingChatResult> {
        if (opts.stream === true) {
            return Chat.create({
                client: this.apiClient,
                cortex: opts.cortex,
                message: opts.message,
                stream: true,
                statusStream: opts.statusStream,
            });
        } else {
            return Chat.create({
                client: this.apiClient,
                cortex: opts.cortex,
                message: opts.message,
                stream: false,
                statusStream: opts.statusStream,
            });
        }
    }

    async getChat(id: string) {
        return Chat.get(this.apiClient, id);
    }

    async generateContent(opts: ClientCreateContentOptsSync): Promise<Content>
    async generateContent(opts: ClientCreateContentOptsStreaming): Promise<StreamingContentResult>
    async generateContent(opts: ClientCreateContentOptsSync | ClientCreateContentOptsStreaming) {
        // note: this if statement is annoying but is necessary to appropriately narrow the return type
        if (opts.stream === true) {
            return Content.create({
                client: this.apiClient,
                cortex: opts.cortex,
                prompt: opts.prompt,
                title: opts.title,
                stream: true,
                statusStream: opts.statusStream
            });
        } else {
            return Content.create({
                client: this.apiClient,
                cortex: opts.cortex,
                prompt: opts.prompt,
                title: opts.title,
                stream: false,
                statusStream: opts.statusStream
            });
        }
    }

    async getContent(id: string, version?: number) {
        return Content.get(this.apiClient, id, version);
    }

    async listContent(paginationOptions?: ClientListContentPaginationOpts) {
        return Content.list(this.apiClient, paginationOptions);
    }

    async listChats() { }

    async getCortex(name: string): Promise<Cortex> {
        return Cortex.get(this.apiClient, name)
    }

    async configureCortex(name: string, opts: CortexConfig): Promise<Cortex> {
        return Cortex.configure(this.apiClient, name, opts);
    }

    async configureOrg(opts: OrgConfigOpts): Promise<OrgConfig> {
        return OrgConfig.configure(this.apiClient, opts);
    }

    async getOrgConfig() {
        return OrgConfig.get(this.apiClient);
    }

    async getCatalog(name: string) {
        return Catalog.get(this.apiClient, name);
    }

    async configureCatalog(name: string, opts: CatalogConfig) {
        return Catalog.configure(this.apiClient, name, opts);
    }

    async listCatalogs() {
        return Catalog.list(this.apiClient);
    }

}
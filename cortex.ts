import { Readable } from "stream";
import { CortexApiClient } from "./api-client.js";
import { Chat, StreamingChatResult } from "./chat.js";
import { Content, StreamingContentResult } from "./content.js";

export type CortexConfig = {
    /**
     * The name that this Cortex should refer to itself as, (e.g. "Acme Assistant", "Acme AI")
     */
    friendlyName: string; // TODO add column to DB
    /**
     * The catalogs that should be referenced when generating content and answering questions
     */
    // TODO: this should accept "string" | Catalog
    catalogs?: string[];
    /**
     * A complete description of the goal task and a list of steps this cortex should follow when generating content and answering questions. 
     */
    instructions: string[];
    /**
     * Whether or not this Cortex should be available on the internet, without authentication. This is common for scenarios like publishing blog content, and customer support.
     */
    public: boolean;
    /**
     * fine-tuned control over the verbosity, tone, and rules that are used to generate content.
     */
    customizations?: {
        /**
         * A list or "dos and dont's" that the cortex should follow.
         */
        rules?: string[];
        personality?: string[];
        chatVerbosity?: string;
        writeVerbosity?: string;
    }
    /**
     * configuration for the built-in hosted chat UI.
     */
    chatConfig?: {
        /**
         * The initial greeting message rendered in chat.
         */
        greeting: string;
        /**
         * An introductory message that explains to users the purpose of this Cortex is and what it can help with.
         */
        intro: string;
        /**
         * A list of questions that will be rendered and suggested to users when they load the chat window.
         */
        examples: string[];

    },
    /**
     * override org-level defaults
     */
    overrides?: {
        /**
         * Whether or not global org-level rules should be followed. Defaults to 'true'.
         */
        inheritRules?: boolean;
        /**
         * The company name
         */
        companyName?: string;
        /**
         * A description of your company, industry, and products and services provided.
         */
        companyInfo?: string;
    }

};

export interface CortexCreateContentOptsBase {
    title: string;
    prompt: string;
    stream?: boolean;
    statusStream?: Readable
}

export interface CortexContentOptsStreaming extends CortexCreateContentOptsBase {
    stream?: true
}

export interface CortexCreateContentOptsSync extends CortexCreateContentOptsBase {
    stream?: false
}

export interface CortexCreateChatOptsBase {
    message: string;
    stream?: boolean;
    statusStream?: Readable;
}

export interface CortexCreateChatOptsStreaming extends CortexCreateChatOptsBase {
    stream?: true
}

export interface CortexCreateChatOptsSync extends CortexCreateChatOptsBase {
    stream?: false
}

export class Cortex {
    private deleted = false;
    private constructor(readonly config: CortexConfig, private apiClient: CortexApiClient, readonly name: string) { }

    static async get(apiClient: CortexApiClient, name: string): Promise<Cortex> {
        const res = await apiClient.GET(`/cortex-config/${name}`);
        if (res.status !== 200) {
            throw new Error(`Failed to get cortex: ${res.statusText}`);
        }
        const body = await res.json();
        const config: CortexConfig = {
            catalogs: body.catalogs,
            friendlyName: body.friendlyName,
            instructions: body.instructions,
            public: !!body.public,
            chatConfig: {
                examples: body.examples,
                greeting: body.greeting,
                intro: body.intro,
            },
            customizations: {
                chatVerbosity: body.chatVerbosity,
                writeVerbosity: body.writeVerbosity,
                personality: body.personality,
            },
            overrides: {
                companyInfo: body.companyInfo,
                companyName: body.companyName,
                inheritRules: !!body.inheritRules,
            }
        };
        return new Cortex(config, apiClient, name);
    }

    static async configure(apiClient: CortexApiClient, name: string, config: CortexConfig): Promise<Cortex> {
        const input: CortexConfigInput = {
            cortexName: name,
            friendlyName: config.friendlyName,
            catalogs: config.catalogs,
            chatVerbosity: config.customizations?.chatVerbosity,
            writeVerbosity: config.customizations?.writeVerbosity,
            companyInfo: config.overrides?.companyInfo,
            companyName: config.overrides?.companyName,
            examples: config.chatConfig?.examples,
            greeting: config.chatConfig?.greeting,
            intro: config.chatConfig?.intro,
            inheritRules: !!config.overrides?.inheritRules,
            public: !!config.public,
            instructions: config.instructions,
            personality: config.customizations?.personality,
            rules: config.customizations?.rules,
        }
        const getRes = await apiClient.GET(`/cortex-config/${name}`);
        let res: Response;
        if (getRes.status !== 200) {
            res = await apiClient.POST("/cortex-config", input);
        } else {
            res = await apiClient.PUT(`/cortex-config/${name}`, input);
        }

        if (res.status !== 200) {
            throw new Error(`Failed to configure cortex: ${res.statusText}`);
        }
        return new Cortex(config, apiClient, name);
    }

    async delete() {
        this.checkDeleted();
        this.deleted = true;
        await this.apiClient.DELETE(`/cortex-config/${this.name}`);
        return;
    }


    async chat(opts: CortexCreateChatOptsSync): Promise<Chat>;
    async chat(opts: CortexCreateChatOptsStreaming): Promise<StreamingChatResult>;
    async chat(opts: CortexCreateChatOptsSync | CortexCreateChatOptsStreaming) {
        if(opts.stream === true) {
            return Chat.create({
                client: this.apiClient,
                cortex: this,
                message: opts.message,
                statusStream: opts.statusStream,
                stream: true,
            });
        } else {
            return Chat.create({
                client: this.apiClient,
                cortex: this,
                message: opts.message,
                statusStream: opts.statusStream,
                stream: false,
            });
        }
    }

    async generateContent(opts: CortexCreateContentOptsSync): Promise<Content>
    async generateContent(opts: CortexContentOptsStreaming): Promise<StreamingContentResult>
    async generateContent(opts: CortexCreateContentOptsSync | CortexContentOptsStreaming) {
        // note: this if statement is annoying but is necessary to appropriately narrow the return type
        if(opts.stream === true ) {
            return Content.create({
                client: this.apiClient,
                cortex: this,
                prompt: opts.prompt,
                title: opts.title,
                stream: true,
                statusStream: opts.statusStream
            })   
        } else {
            return Content.create({
                client: this.apiClient,
                cortex: this,
                prompt: opts.prompt,
                title: opts.title,
                stream: false,
                statusStream: opts.statusStream
            })   
        }
    }

    private checkDeleted() {
        if (this.deleted) {
            throw new Error(`cortex: ${this.name} has already been deleted`);
        }
    }
}

type CortexConfigInput = {
    cortexName: string;
    friendlyName: string;
    public: boolean;
    inheritRules: boolean;
    companyName?: string;
    companyInfo?: string;
    rules?: string[];
    instructions: string[];
    personality?: string[];
    chatVerbosity?: string;
    writeVerbosity?: string;
    catalogs?: string[];
    greeting?: string;
    intro?: string;
    examples?: string[];
};
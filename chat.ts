import { Cortex } from "./cortex.js";
import { CortexApiClient } from "./api-client.js";
import { Readable } from "stream";
import { processStream } from "./utils/streaming.js";

export interface CreateChatOptsBase {
  client: CortexApiClient;
  cortex: Cortex;
  message: string;
  stream?: boolean;
  statusStream?: Readable;
}

export interface CreateChatOptsStreaming extends CreateChatOptsBase {
  stream?: true;
}

export interface CreateChatOptsSync extends CreateChatOptsBase {
  stream?: false;
}

export type StreamingChatResult = {
  readonly responseStream: Readable;
  readonly chat: Promise<Chat>;
};

export interface RespondChatOptsBase {
  message: string;
  cortex?: Cortex;
  stream?: boolean;
  statusStream?: Readable;
}

export interface RespondChatOptsStreaming extends RespondChatOptsBase {
  stream?: true;
}

export interface RespondChatOptsSync extends RespondChatOptsBase {
  stream?: false;
}

export interface ChatListItem {
  title: string;
  id: string;
  messageCount: number;
  Chat(): Promise<Chat>;
}
export interface ChatListResult {
  chats: ChatListItem[];
  nextPage: () => Promise<ChatListResult>;
}
export interface ChatListPaginationOpts {
  cursor?: string;
  pageSize?: number;
}

export type Message = {
  role: "user" | "cortex";
  message: string;
};

export class Chat {
  private constructor(
    private apiClient: CortexApiClient,
    readonly id: string,
    readonly title: string,
    readonly messages: Message[],
  ) {}

  static async create(opts: CreateChatOptsSync): Promise<Chat>;
  static async create(
    opts: CreateChatOptsStreaming,
  ): Promise<StreamingChatResult>;
  static async create(
    opts: CreateChatOptsSync | CreateChatOptsStreaming,
  ): Promise<Chat | StreamingChatResult> {
    if (isCreateChatOptsSync(opts)) {
      return this.createContentSync(opts);
    } else {
      return this.createContentStreaming(opts);
    }
  }

  private static async createContentSync(
    opts: CreateChatOptsSync,
  ): Promise<Chat> {
    const { client, cortex, message } = opts;
    const res = await client.POST(`/chats`, { cortex: cortex.name, message });
    const body = await res.json();
    const messages: Message[] = [
      {
        role: "user",
        message,
      },
      {
        role: "cortex",
        message: body.response,
      },
    ];
    return new Chat(client, body.id, body.title, messages);
  }

  private static async createContentStreaming(
    opts: CreateChatOptsStreaming,
  ): Promise<StreamingChatResult> {
    const { client, cortex, message } = opts;
    const res = await client.POST(`/chats`, {
      cortex: cortex.name,
      message,
      stream: true,
    });
    const reader = res.body!.getReader();
    const decoder = new TextDecoder("utf-8");

    const id: string = res.headers.get("id") || "";
    const title: string = res.headers.get("title") || "";

    const readableStream = new Readable({
      read() {},
    });

    const chatPromise = processStream(
      reader,
      decoder,
      readableStream,
      opts.statusStream,
    ).then((content) => {
      const messages: Message[] = [
        {
          role: "user",
          message,
        },
        {
          role: "cortex",
          message: content,
        },
      ];
      return new Chat(client, id, title, messages);
    });

    return { responseStream: readableStream, chat: chatPromise };
  }

  static async get(client: CortexApiClient, id: string): Promise<Chat> {
    const res = await client.GET(`/chats/${id}`);
    if (res.status !== 200) {
      throw new Error(`Failed to get chat: ${res.statusText}`);
    }
    const body = await res.json();
    return new Chat(client, id, body.title, body.messages);
  }

  static async list(
    client: CortexApiClient,
    paginationOpts?: ChatListPaginationOpts,
  ): Promise<ChatListResult> {
    const chats: ChatListItem[] = [];

    const query = new URLSearchParams();
    if (paginationOpts?.cursor) {
      query.set("cursor", paginationOpts.cursor);
    }
    query.set("pageSize", (paginationOpts?.pageSize || 50).toString());
    const res = await client.GET(`/chats?${query.toString()}`);
    if (res.status !== 200) {
      throw new Error(`Failed to list chats: ${res.statusText}`);
    }
    const body = await res.json();
    for (const chat of body.chats) {
      chats.push({
        title: chat.title,
        id: chat.chatId,
        messageCount: chat.messageCount,
        Chat: () => {
          return Chat.get(client, chat.chatId);
        },
      });
    }

    const cursor = body.cursor;
    const pageSize = paginationOpts?.pageSize;
    return {
      chats,
      nextPage: async () => {
        return Chat.list(client, { cursor, pageSize });
      },
    };
  }

  async respond(opts: RespondChatOptsSync): Promise<string>;
  async respond(opts: RespondChatOptsStreaming): Promise<StreamingChatResult>;
  async respond(
    opts: RespondChatOptsSync | RespondChatOptsStreaming,
  ): Promise<string | StreamingChatResult> {
    if (isRespondChatOptsSync(opts)) {
      return this.respondChatSync(opts);
    } else {
      return this.respondChatStreaming(opts);
    }
  }

  private async respondChatSync(opts: RespondChatOptsSync): Promise<string> {
    const { message, cortex } = opts;
    const res = await this.apiClient.POST(`/chats/${this.id}`, {
      message,
      cortex,
    });
    const body = await res.json();
    this.messages.push(
      {
        role: "user",
        message,
      },
      {
        role: "cortex",
        message: body.response,
      },
    );

    return body.response;
  }

  private async respondChatStreaming(
    opts: RespondChatOptsStreaming,
  ): Promise<StreamingChatResult> {
    const { message, cortex } = opts;
    const res = await this.apiClient.POST(`/chats/${this.id}`, {
      message,
      cortex,
      stream: true,
    });
    const reader = res.body!.getReader();
    const decoder = new TextDecoder("utf-8");

    const readableStream = new Readable({
      read() {},
    });

    const chatPromise = processStream(
      reader,
      decoder,
      readableStream,
      opts.statusStream,
    ).then((content) => {
      this.messages.push(
        {
          role: "user",
          message,
        },
        {
          role: "cortex",
          message: content,
        },
      );
      return this;
    });

    return { responseStream: readableStream, chat: chatPromise };
  }
}

function isCreateChatOptsSync(
  opts: CreateChatOptsSync | CreateChatOptsStreaming,
): opts is CreateChatOptsSync {
  return opts.stream === false || opts.stream === undefined;
}

function isRespondChatOptsSync(
  opts: RespondChatOptsSync | RespondChatOptsStreaming,
): opts is RespondChatOptsSync {
  return opts.stream === false || opts.stream === undefined;
}

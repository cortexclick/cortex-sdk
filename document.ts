import { CortexApiClient } from "./api-client.js";
import { Catalog } from "./catalog.js";

export type TextContentType = "text" | "markdown";
export type JSONContentType = "json";
export type FileContentType = "file";

export type ContentType = FileContentType | TextContentType | JSONContentType;

export type JSONDocument = {
  documentId: string;
  content: object;
  contentType: JSONContentType;
  url?: string;
  imageUrl?: string;
};

export type TextDocument = {
  documentId: string;
  content: string;
  contentType: TextContentType;
  url?: string;
  imageUrl?: string;
};

export type FileDocument = {
  documentId: string;
  contentType: FileContentType;
  filePath: string;
  url?: string;
  imageUrl?: string;
};

export type DocumentBatch = TextDocument[] | JSONDocument[] | FileDocument[];

export type DocumentInput = {
  documentId: string;
  content?: string;
  contentType: ContentType;
  url?: string;
  imageUrl?: string;
};

export class Document {
  private constructor(
    readonly catalog: Catalog,
    private apiClient: CortexApiClient,
    readonly documentId: string,
    readonly content: string,
    readonly contentType: ContentType,
    readonly url?: string,
    readonly imageUrl?: string,
  ) {}

  static async get(
    apiClient: CortexApiClient,
    catalog: Catalog,
    documentId: string,
  ): Promise<Document> {
    encodeURIComponent;
    const res = await apiClient.GET(
      `/catalogs/${catalog.name}/documents/${encodeURIComponent(documentId)}`,
    );
    if (res.status !== 200) {
      throw new Error(`Failed to get document: ${res.statusText}`);
    }

    const body = await res.json();

    return new Document(
      catalog,
      apiClient,
      documentId,
      body.content,
      body.contentType,
      body.url,
      body.imageUrl,
    );
  }

  async delete() {
    const res = await this.apiClient.DELETE(
      `/catalogs/${this.catalog.name}/documents/${encodeURIComponent(this.documentId)}`,
    );
    if (res.status !== 200) {
      throw new Error(`Failed to delete document: ${res.statusText}`);
    }
  }
}

export type DocumentListItem = {
  documentId: string;
  contentType: ContentType;
  url?: string;
  imageUrl?: string;
  get: () => Promise<Document>;
  delete: () => Promise<void>;
};

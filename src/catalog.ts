import { CortexApiClient } from "./api-client";
import {
  DocumentBatch,
  DocumentInput,
  FileDocument,
  Document,
  DocumentListItem,
} from "./document";
import * as fs from "node:fs";
import { JSONIndexer, JSONIndexerOpts } from "./indexers/local/json-indexer";
import {
  DirectoryIndexer,
  DirectoryIndexerOpts,
} from "./indexers/local/directory-indexer";
import { TSVIndexer, TSVIndexerOpts } from "./indexers/local/tsv-indexer";
import {
  ShopifyIndexer,
  ShopifyIndexerOpts,
} from "./indexers/local/shopify-indexer";

export type CatalogConfig = {
  description: string;
  instructions: string[];
};

export type CatalogListResult = {
  name: string;
  description: string;
  documentCount: number;
  Catalog(): Promise<Catalog>;
};

export type DocumentListResult = {
  documents: DocumentListItem[];
  nextPage: () => Promise<DocumentListResult>;
};

export type DocumentPaginationOpts = {
  page: number;
  pageSize?: number;
};

export type CreateCatalogConfig = CatalogConfig & { catalogName: string };

export type UpsertDocumentsResult = { warnings: string[] };

export class Catalog {
  private deleted = false;
  private constructor(
    readonly config: CatalogConfig,
    private apiClient: CortexApiClient,
    readonly name: string,
  ) {}

  static async get(apiClient: CortexApiClient, name: string): Promise<Catalog> {
    const res = await apiClient.GET(`/catalogs/${name}`);
    if (res.status > 201) {
      throw new Error(`Failed to get catalog: ${res.statusText}`);
    }
    const body = await res.json();
    const config: CatalogConfig = {
      description: body.description,
      instructions: body.instructions,
    };
    return new Catalog(config, apiClient, name);
  }

  static async configure(
    apiClient: CortexApiClient,
    name: string,
    config: CatalogConfig,
  ): Promise<Catalog> {
    const createConfig: CreateCatalogConfig = {
      ...config,
      catalogName: name,
    };
    const getRes = await apiClient.GET(`/catalogs/${name}`);
    let res: Response;
    if (getRes.status === 200) {
      res = await apiClient.PUT(`/catalogs/${name}`, config);
    } else if (getRes.status === 404) {
      res = await apiClient.POST("/catalogs", createConfig);
    } else {
      const message =
        getRes.status === 400 ? await getRes.text() : getRes.statusText;
      throw new Error(`Failed to configure catalog: ${message}`);
    }

    if (res.status > 201) {
      const message = res.status === 400 ? await res.text() : res.statusText;
      throw new Error(`Failed to configure catalog: ${message}`);
    }
    return new Catalog(config, apiClient, name);
  }

  static async list(apiClient: CortexApiClient): Promise<CatalogListResult[]> {
    const result: CatalogListResult[] = [];

    const res = await apiClient.GET(`/catalogs`);
    if (res.status !== 200) {
      throw new Error(`Failed to list catalog: ${res.statusText}`);
    }
    const body = await res.json();
    for (const catalog of body.catalogs) {
      result.push({
        name: catalog.name,
        description: catalog.description,
        documentCount: parseInt(catalog.documentCount),
        Catalog: () => {
          return Catalog.get(apiClient, catalog.name);
        },
      });
    }

    return result;
  }

  public async documentCount() {
    this.checkDeleted();
    const res = await this.apiClient.GET(`/catalogs/${this.name}`);
    if (res.status !== 200) {
      throw new Error(`Failed to get catalog: ${res.statusText}`);
    }

    const body = await res.json();
    return parseInt(body.documentCount);
  }

  public async truncate() {
    this.checkDeleted();
    const res = await this.apiClient.POST(`/catalogs/${this.name}/truncate`);
    if (res.status > 201) {
      throw new Error(`Failed to get catalog: ${res.statusText}`);
    }
  }

  public async upsertDocuments(
    batch: DocumentBatch,
  ): Promise<UpsertDocumentsResult> {
    if (batch.length === 0) {
      throw new Error("Document batch must not be empty");
    }

    this.checkDeleted();
    let hasText = false;
    let hasFile = false;
    let hasJson = false;
    let hasUrl = false;
    let hasSitemapUrl = false;
    for (const [index, doc] of batch.entries()) {
      const contentType = doc.contentType;
      switch (contentType) {
        case "markdown":
        case "text":
          hasText = true;
          break;
        case "json":
          hasJson = true;
          break;
        case "file":
          hasFile = true;
          break;
        case "url":
          hasUrl = true;
          break;
        case "sitemap-url":
          hasSitemapUrl = true;
          break;
        default:
          throw new Error(
            `Unsupported content type: ${contentType} for document at index ${index}`,
          );
      }
    }

    if (
      [hasText, hasJson, hasFile, hasUrl, hasSitemapUrl].filter((v) => v)
        .length > 1
    ) {
      throw new Error(
        `cannot mix file, text, url, sitemap-url, json content in batch upsert. all documents in batch must have the same contentType.`,
      );
    }

    const { blobs, documents } = await mapBatch(batch);
    let res: Response;
    if (blobs.length === 0) {
      res = await this.apiClient.POST(`/catalogs/${this.name}/documents`, {
        documents,
      });
    } else {
      const fd = new FormData();
      for (let i = 0; i < blobs.length; i++) {
        const blob = blobs[i];
        fd.append("files", blob, (batch[i] as FileDocument).filePath);
      }
      fd.append("documentsJSON", JSON.stringify(documents));
      res = await this.apiClient.POSTForm(
        `/catalogs/${this.name}/documents`,
        fd,
      );
    }

    if (res.status > 202) {
      const message = res.status === 400 ? await res.text() : res.statusText;
      throw new Error(`Failed to upsert documents: ${message}`);
    }

    const body = await res.json();

    return { warnings: body?.warnings ?? [] };
  }

  public async delete() {
    this.checkDeleted();
    this.deleted = true;
    await this.apiClient.DELETE(`/catalogs/${this.name}`);
    return;
  }

  public async getDocument(documentId: string): Promise<Document> {
    this.checkDeleted();
    return Document.get(this.apiClient, this, documentId);
  }

  public async deleteDocument(documentId: string) {
    this.checkDeleted();
    const doc = await this.getDocument(documentId);
    await doc.delete();
  }

  public async listDocuments(
    paginationOpts?: DocumentPaginationOpts,
  ): Promise<DocumentListResult> {
    const { page, pageSize } = paginationOpts || { page: 1, pageSize: 50 };
    const nextPageOpts: DocumentPaginationOpts = { page: page + 1, pageSize };
    const nextPage = () => {
      return this.listDocuments(nextPageOpts);
    };

    this.checkDeleted();
    const res = await this.apiClient.GET(
      `/catalogs/${this.name}/documents?page=${page}&pageSize=${pageSize}`,
    );
    if (res.status !== 200) {
      throw new Error(`Failed to get document: ${res.statusText}`);
    }

    const body = await res.json();

    return {
      documents: body.documents || [],
      nextPage,
    };
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  public jsonIndexer(documents: any[], opts?: JSONIndexerOpts) {
    return new JSONIndexer(this, documents, opts);
  }

  public directoryIndexer(opts: DirectoryIndexerOpts) {
    return new DirectoryIndexer(this, opts);
  }

  public tsvIndexer(file: string, opts?: TSVIndexerOpts) {
    return new TSVIndexer(this, file, opts);
  }

  public shopifyIndexer(opts: ShopifyIndexerOpts) {
    return new ShopifyIndexer(this, opts);
  }

  private checkDeleted() {
    if (this.deleted) {
      throw new Error(`cortex: ${this.name} has already been deleted`);
    }
  }
}

const mapBatch = async (batch: DocumentBatch) => {
  const blobs: Promise<Blob>[] = [];
  const documents: DocumentInput[] = [];

  for (const doc of batch) {
    switch (doc.contentType) {
      case "markdown":
      case "text":
        documents.push({
          ...doc,
        });
        break;
      case "json":
        documents.push({
          ...doc,
          content: JSON.stringify(doc.content),
        });
        break;
      case "file":
        blobs.push(fs.openAsBlob(doc.filePath));
        documents.push({
          ...doc,
          content: undefined,
        });
        break;
      case "url":
        documents.push({
          documentId: doc.url,
          contentType: "url",
        });
        break;
      case "sitemap-url":
        documents.push({
          documentId: doc.sitemapUrl,
          contentType: "sitemap-url",
        });
        break;
      default:
        throw new Error(
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          `unsupported content type: ${(doc as any).contentType}`,
        );
    }
  }
  const resolvedBlobs = await Promise.all(blobs);

  return {
    blobs: resolvedBlobs,
    documents,
  };
};

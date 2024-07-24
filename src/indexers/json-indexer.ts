import { Catalog } from "../catalog";
import { JSONDocument } from "../document";

// intentionally operates on any type
/* eslint-disable  @typescript-eslint/no-explicit-any */

export type JSONIndexerOpts = {
  batchSize?: number;
  getId?: (document: any) => string;
  getUrl?: (document: any) => string | undefined;
  getImageUrl?: (document: any) => string | undefined;
};

export class JSONIndexer {
  private readonly batchSize: number;
  private readonly getId: (document: any) => string;
  private readonly getImageUrl: (document: any) => string | undefined;
  private readonly getUrl: (document: any) => string | undefined;
  private batch: JSONDocument[] = [];

  constructor(
    private catalog: Catalog,
    private documents: any[],
    opts?: JSONIndexerOpts,
  ) {
    this.batchSize = opts?.batchSize ?? 50;
    this.getId = opts?.getId ?? JSONIndexer.defaultGetId;
    this.getUrl = opts?.getUrl ?? JSONIndexer.defaultGetUrl;
    this.getImageUrl = opts?.getImageUrl ?? JSONIndexer.defaultGetImageUrl;
  }

  public static defaultGetId(document: any): string {
    const id = JSONIndexer.findFirstMatchingProperty(
      document,
      "id",
      "Id",
      "ID",
      "documentId",
      "documentID",
      "DocumentId",
      "DocumentID",
    );
    if (!id) {
      throw new Error(
        "All documents must contain an 'id' or 'documentId' field, or you must provide opts.getId when using JSONIndexer.",
      );
    }

    return id;
  }

  public static defaultGetUrl(document: any): string | undefined {
    return JSONIndexer.findFirstMatchingProperty(document, "url");
  }

  public static defaultGetImageUrl(document: any): string | undefined {
    return JSONIndexer.findFirstMatchingProperty(document, "imageUrl");
  }

  private static findFirstMatchingProperty(
    document: any,
    ...propertyNames: string[]
  ): string | undefined {
    for (const prop of propertyNames) {
      if (prop in document) {
        return document[prop];
      }
    }

    return undefined;
  }

  public async index() {
    await this.indexItems();
  }

  private async indexItems(): Promise<void> {
    for (const document of this.documents) {
      if (this.batch.length > this.batchSize) {
        await this.catalog.upsertDocuments(this.batch);
        this.batch = [];
      }

      this.batch.push({
        documentId: this.getId(document),
        imageUrl: this.getImageUrl(document),
        url: this.getUrl(document),
        content: document,
        contentType: "json",
      });
    }

    if (this.batch.length) {
      await this.catalog.upsertDocuments(this.batch);
      this.batch = [];
    }
  }
}

import * as fs from "node:fs";
import { Catalog } from "../catalog.js";
import { JSONIndexer } from "./json-indexer.js";

// intentionally operates on any type
/* eslint-disable  @typescript-eslint/no-explicit-any */

export type TSVIndexerOpts = {
  getId?: (item: any) => string;
  getUrl?: (item: any) => string;
  getImageUrl?: (item: any) => string;
  fieldMapping?: { [key: string]: string };
};

export class TSVIndexer {
  private readonly getId: (document: any) => string;
  private readonly getImageUrl: (document: any) => string | undefined;
  private readonly getUrl: (document: any) => string | undefined;
  private documents: any[] = [];
  private fieldMapping: undefined | { [key: string]: string };

  constructor(
    public catalog: Catalog,
    private file: string,
    opts?: TSVIndexerOpts,
  ) {
    this.getId = opts?.getId ?? JSONIndexer.defaultGetId;
    this.getUrl = opts?.getUrl ?? JSONIndexer.defaultGetUrl;
    this.getImageUrl = opts?.getImageUrl ?? JSONIndexer.defaultGetImageUrl;

    if (opts?.fieldMapping) {
      this.fieldMapping = opts?.fieldMapping;
    }
  }

  public async index() {
    await this.indexItems();
  }

  private async indexItems(): Promise<void> {
    const content = fs.readFileSync(this.file).toString();
    const rows = content.split("\n");
    const header = rows[0].split("\t");
    for (let i = 1; i < rows.length; i++) {
      const row = rows[i].split("\t");
      const document: { [key: string]: string } = {};
      for (let j = 0; j < header.length; j++) {
        if (this.fieldMapping) {
          if (this.fieldMapping[header[j]]) {
            document[this.fieldMapping[header[j]]] = row[j];
          }
        } else {
          document[header[j]] = row[j];
        }
      }

      // Note that this should generate a document whose id, imageUrl, url properties can be picked up by JSON indexer using the defaßult options
      this.documents.push({
        documentId: this.getId(document),
        content: document,
        contentType: "json",
        imageUrl: this.getImageUrl(document),
        url: this.getUrl(document),
      });
    }

    const jsonIndexer = this.catalog.jsonIndexer(this.documents);

    await jsonIndexer.index();
  }
}

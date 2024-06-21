import * as fs from "node:fs";
import { Catalog } from "../catalog.js";
import { FileDocument } from "../document.js";

export type DirectoryIndexerOpts = {
  rootDir: string;
  urlBase?: string;
  getUrl?: (docPathList: string[], sitePathList: string[]) => string;
  getId?: (docPathList: string[], sitePathList: string[]) => string;
  getImageUrl?: (docPathList: string[], sitePathList: string[]) => string;
  includeFile?: (filePath: string) => boolean;
  includeDirectory?: (path: string) => boolean;
};

export class DirectoryIndexer {
  private parallelism = 25;
  private rootDir: string;
  private urlBase?: string;
  private files: FileDocument[] = [];
  constructor(
    public catalog: Catalog,
    opts: DirectoryIndexerOpts,
  ) {
    this.rootDir = opts.rootDir;
    this.urlBase = opts.urlBase;

    if (opts.includeFile) {
      this.includeFile = opts.includeFile;
    }

    if (opts.includeDirectory) {
      this.includeDirectory = opts.includeDirectory;
    }

    if (opts.getId) {
      this.getId = opts.getId;
    }

    if (opts.getUrl) {
      this.getUrl = opts.getUrl;
    }

    if (opts.getImageUrl) {
      this.getImageUrl = opts.getImageUrl;
    }
  }

  public async index() {
    const sitePathList = this.urlBase ? [this.urlBase] : [];
    await this.processDirectory([this.rootDir], sitePathList);
    if (this.files.length) {
      await this.catalog.upsertDocuments(this.files);
      this.files = [];
    }
  }

  private async processDirectory(
    docPathList: string[],
    sitePathList: string[],
  ) {
    const fileList = fs.readdirSync(docPathList.join("/"));

    for (const f of fileList) {
      const path = [...docPathList, f].join("/");
      const stat = fs.lstatSync(path);
      if (stat.isDirectory() && this.includeDirectory(f)) {
        await this.processDirectory([...docPathList, f], [...sitePathList, f]);
      }
      if (stat.isFile() && this.includeFile(f)) {
        await this.processDocument([...docPathList, f], [...sitePathList, f]);
      }
    }
  }

  private async processDocument(docPathList: string[], sitePathList: string[]) {
    const id = this.getId([...docPathList], [...sitePathList]);
    const url = this.getUrl([...docPathList], [...sitePathList]);
    const imageUrl = this.getImageUrl([...docPathList], [...sitePathList]);
    const docPath = docPathList.join("/");

    this.files.push({
      documentId: id,
      contentType: "file",
      filePath: docPath,
      imageUrl,
      url,
    });

    if (this.files.length >= this.parallelism) {
      await this.catalog.upsertDocuments(this.files);
      this.files = [];
    }
  }

  private getUrl(
    _docPathList: string[],
    _sitePathList: string[],
  ): string | undefined {
    return undefined;
  }

  private getId(_docPathList: string[], sitePathList: string[]): string {
    return sitePathList.join("/");
  }

  private getImageUrl(
    _docPathList: string[],
    _sitePathList: string[],
  ): string | undefined {
    return undefined;
  }

  private includeFile(filename: string): boolean {
    return (
      filename.endsWith(".md") ||
      filename.endsWith(".mdx") ||
      filename.endsWith(".txt") ||
      filename.endsWith(".docx")
    );
  }

  private includeDirectory(directoryName: string): boolean {
    return directoryName !== ".";
  }
}

import { Catalog } from "../catalog.js";

type Product = {
  id: string;
  title: string;
  description: string;
  productType: string;
  imageUrl: string | undefined;
  price: string;
  vendor: string;
  tags: string | undefined;
  url: string;
};

export type ShopifyIndexerOpts = {
  shopifyBaseUrl: string;
  maxItems?: number;
  batchSize?: number;
};

export class ShopifyIndexer {
  private readonly batchSize: number;
  private documents: Product[] = [];
  private deletes: Promise<void>[] = [];
  private idsToDelete: string[] = [];
  private page = 1;
  constructor(
    private catalog: Catalog,
    private opts: ShopifyIndexerOpts,
  ) {
    this.batchSize = opts.batchSize ?? 25;
  }

  private stripHTML(input: string) {
    return input.replace(/<\/?[^>]+(>|$)/g, "");
  }

  public async index() {
    let moreItems = true;
    while (moreItems) {
      const req = await fetch(
        `${this.opts.shopifyBaseUrl}/products.json?page=${this.page}`,
        {
          method: "GET",
        },
      );

      const res = await req.json();

      if (!res.products || !res.products.length) {
        moreItems = false;
        continue;
      }
      this.page = this.page + 1;

      for (const item of res.products) {
        let available = false;
        for (const v of item.variants) {
          available = available || v.available;
        }
        if (!available) {
          this.idsToDelete.push(item.id);
          continue;
        }
        let imageUrl = undefined;
        if (item.images && item.images[0]) {
          if (item.images[0].src) {
            imageUrl = item.images[0].src;
          } else if (
            item.variants &&
            item.variants[0] &&
            item.variants[0].featured_image
          ) {
            imageUrl = item.variants[0].featured_image.src;
          }
        }

        if (this.opts.maxItems && this.documents.length >= this.opts.maxItems) {
          moreItems = false;
          break;
        }

        this.documents.push({
          id: item.id.toString(),
          title: item.title,
          description: this.stripHTML(item.body_html),
          productType: item.product_type,
          imageUrl: imageUrl,
          price: item.variants[0].price,
          vendor: item.vendor,
          tags: item.tags ? JSON.stringify(item.tags) : undefined,
          url: `${this.opts.shopifyBaseUrl}/products/${item.handle}`,
        });
      }
    }

    await this.indexProducts();
    await this.deleteProducts();
  }

  private async indexProducts(): Promise<void> {
    const indexer = this.catalog.jsonIndexer(this.documents, {
      batchSize: this.batchSize,
    });
    await indexer.index();
  }

  private async deleteProducts(): Promise<void> {
    for (const id of this.idsToDelete) {
      if (this.deletes.length >= this.batchSize) {
        await Promise.all(this.deletes);
        this.deletes = [];
      }

      const res = this.catalog.deleteDocument(id).catch(() => {});
      this.deletes.push(res);
    }

    await Promise.all(this.deletes);
    this.deletes = [];
    return;
  }
}

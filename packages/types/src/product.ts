type ProductMedia = {
  id: string;
  public_url: string;
};

export type Product = {
  id: string;
  name: string;
  description: string | null;
  medias: ReadonlyArray<ProductMedia>;
  prices: ReadonlyArray<{
    price_amount: number;
    price_currency: string;
  }>;
};

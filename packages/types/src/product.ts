type ProductMedia = {
  id: string;
  public_url: string;
};

export type Product = {
  id: string;
  name: string;
  description: string;
  medias: ProductMedia[];
  prices: Array<{
    price_amount: number;
    price_currency: string;
  }>;
};

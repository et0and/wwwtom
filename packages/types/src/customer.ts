import type { Schema } from "effect";
import type { polarCustomerSchema } from "@tom/schemas/polar";

export type CustomerInput = {
  email: string;
  name?: string | undefined;
  externalId: string;
};

export type Customer = Schema.Schema.Type<typeof polarCustomerSchema>;

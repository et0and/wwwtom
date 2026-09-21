import type { Schema } from "effect";
import type { polarProductSchema } from "@tom/schemas/polar";

export type Product = Schema.Schema.Type<typeof polarProductSchema>;

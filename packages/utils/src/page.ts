import { Option, Schema } from "effect";
import { PageNumberSchema } from "@tom/schemas/cms";

/** Parse an unknown page query value; invalid pages default to 1. */
// oxlint-disable-next-line anti-slop/no-unknown-parameters -- boundary decodes via Schema.decodeUnknownOption
export const parsePageNumber = (value: unknown): number =>
  Option.getOrElse(Schema.decodeUnknownOption(PageNumberSchema)(value), () => 1);

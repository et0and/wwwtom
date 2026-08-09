import { Schema } from "effect";

const JsonLdPersonSchema = Schema.Struct({
  "@type": Schema.Literal("Person"),
  name: Schema.String,
});

const JsonLdCollectionPageSchema = Schema.Struct({
  "@context": Schema.Literal("https://schema.org"),
  "@type": Schema.Literal("CollectionPage"),
  name: Schema.String,
  description: Schema.String,
  url: Schema.String,
});

const JsonLdBlogPostingSchema = Schema.Struct({
  "@context": Schema.Literal("https://schema.org"),
  "@type": Schema.Literal("BlogPosting"),
  headline: Schema.String,
  description: Schema.String,
  datePublished: Schema.String,
  dateModified: Schema.String,
  url: Schema.String,
  author: JsonLdPersonSchema,
});

const JsonLdCreativeWorkSchema = Schema.Struct({
  "@context": Schema.Literal("https://schema.org"),
  "@type": Schema.Literal("CreativeWork"),
  name: Schema.String,
  description: Schema.String,
  url: Schema.String,
  author: JsonLdPersonSchema,
});

export const JsonLdSchema = Schema.Union([
  JsonLdCollectionPageSchema,
  JsonLdBlogPostingSchema,
  JsonLdCreativeWorkSchema,
]);

export type JsonLd = Schema.Schema.Type<typeof JsonLdSchema>;

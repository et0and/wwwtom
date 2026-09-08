import { Effect, Schema } from "effect";
import { CmsError } from "@tom/types/errors";
import {
  CmsCategoryInputSchema,
  CmsCategorySchema,
  CmsListResponseSchema,
  CmsMediaSchema,
  CmsMediaUsageSchema,
  CmsPostInputSchema,
  CmsPostSchema,
  CmsRestoreInputSchema,
  CmsRevisionMetaSchema,
  CmsRevisionSnapshotSchema,
  CmsWorkInputSchema,
  CmsWorkSchema,
} from "@tom/schemas/cms";
import type {
  CmsCategory,
  CmsListResponse,
  CmsMedia,
  CmsMediaUsage,
  CmsPost,
  CmsPostInput,
  CmsRevisionMeta,
  CmsRevisionSnapshot,
  CmsSlug,
  CmsStatus,
  CmsWork,
  CmsWorkInput,
  TiptapDoc,
} from "@tom/schemas/cms";
import { decodeResponse, requestJson } from "./api";

export type ContentKind = "posts" | "works";

/** Rows per content list page, shared by the list view and the API query. */
export const PAGE_SIZE = 10;

/** Clamp a requested page to a valid 1-based number. Guards NaN/Infinity. */
const safePage = (page: number): number =>
  Number.isFinite(page) ? Math.max(1, Math.floor(page)) : 1;

const postListSchema = CmsListResponseSchema(CmsPostSchema);
const workListSchema = CmsListResponseSchema(CmsWorkSchema);
const categoryListSchema = Schema.Array(CmsCategorySchema);
const mediaListSchema = CmsListResponseSchema(CmsMediaSchema);
const revisionMetaListSchema = Schema.Array(CmsRevisionMetaSchema);
const deleteResultSchema = Schema.Struct({ id: Schema.String });

/** String codecs: encode validates and serializes in one step, no JSON.stringify. */
const postInputJson = Schema.fromJsonString(CmsPostInputSchema);
const workInputJson = Schema.fromJsonString(CmsWorkInputSchema);
const categoryInputJson = Schema.fromJsonString(CmsCategoryInputSchema);
const restoreInputJson = Schema.fromJsonString(CmsRestoreInputSchema);

/** Public file URL for a media id (used by previews and hero images). */
export const mediaFileUrl = (adapterOrigin: string, mediaId: string): string =>
  `${adapterOrigin}/content/media/${encodeURIComponent(mediaId)}/file`;

const fetchAndDecode = <A, I>(
  path: string,
  init: RequestInit,
  schema: Schema.Codec<A, I>,
  operation: string,
): Effect.Effect<A, CmsError> =>
  Effect.flatMap(requestJson(path, init, operation), (json) =>
    decodeResponse(schema, json, operation),
  );

const jsonBody = (body: string): RequestInit => ({
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body,
});

/** Encode a validated input to its JSON string body. */
const encodeBody = (encode: () => string, operation: string): Effect.Effect<string, CmsError> =>
  Effect.try({
    try: encode,
    catch: (cause) =>
      new CmsError({ message: "Invalid editor data", status: 500, operation, cause }),
  });

export const listPosts = (
  page: number,
  category?: CmsSlug | "pages",
): Effect.Effect<CmsListResponse<CmsPost>, CmsError> =>
  fetchAndDecode(
    `/content/posts?status=all&page=${safePage(page)}&pageSize=${PAGE_SIZE}${
      category === undefined ? "" : `&category=${encodeURIComponent(category)}`
    }`,
    {},
    postListSchema,
    "list_posts",
  );

export const listWorks = (page: number): Effect.Effect<CmsListResponse<CmsWork>, CmsError> =>
  fetchAndDecode(
    `/content/works?status=all&page=${safePage(page)}&pageSize=${PAGE_SIZE}`,
    {},
    workListSchema,
    "list_works",
  );

export const getPost = (slug: string): Effect.Effect<CmsPost, CmsError> =>
  fetchAndDecode(`/content/posts/${encodeURIComponent(slug)}`, {}, CmsPostSchema, "get_post");

export const getWork = (slug: string): Effect.Effect<CmsWork, CmsError> =>
  fetchAndDecode(`/content/works/${encodeURIComponent(slug)}`, {}, CmsWorkSchema, "get_work");

const saveContent = <A, I>(
  kind: ContentKind,
  slug: string | null,
  body: string,
  schema: Schema.Codec<A, I>,
  operation: string,
): Effect.Effect<A, CmsError> =>
  fetchAndDecode(
    slug === null ? `/content/${kind}` : `/content/${kind}/${encodeURIComponent(slug)}`,
    { ...jsonBody(body), method: slug === null ? "POST" : "PUT" },
    schema,
    operation,
  );

export const savePost = (
  slug: string | null,
  input: CmsPostInput,
): Effect.Effect<CmsPost, CmsError> =>
  Effect.flatMap(
    encodeBody(() => Schema.encodeSync(postInputJson)(input), "save_post"),
    (body) => saveContent("posts", slug, body, CmsPostSchema, "save_post"),
  );

export const saveWork = (
  slug: string | null,
  input: CmsWorkInput,
): Effect.Effect<CmsWork, CmsError> =>
  Effect.flatMap(
    encodeBody(() => Schema.encodeSync(workInputJson)(input), "save_work"),
    (body) => saveContent("works", slug, body, CmsWorkSchema, "save_work"),
  );

export const deletePost = (slug: string): Effect.Effect<{ readonly id: string }, CmsError> =>
  fetchAndDecode(
    `/content/posts/${encodeURIComponent(slug)}`,
    { method: "DELETE" },
    deleteResultSchema,
    "delete_post",
  );

export const deleteWork = (slug: string): Effect.Effect<{ readonly id: string }, CmsError> =>
  fetchAndDecode(
    `/content/works/${encodeURIComponent(slug)}`,
    { method: "DELETE" },
    deleteResultSchema,
    "delete_work",
  );

export const listRevisions = (
  kind: ContentKind,
  slug: string,
): Effect.Effect<ReadonlyArray<CmsRevisionMeta>, CmsError> =>
  fetchAndDecode(
    `/content/${kind}/${encodeURIComponent(slug)}/revisions`,
    {},
    revisionMetaListSchema,
    "list_revisions",
  );

export const getRevision = (
  kind: ContentKind,
  slug: string,
  revisionId: string,
): Effect.Effect<CmsRevisionSnapshot, CmsError> =>
  fetchAndDecode(
    `/content/${kind}/${encodeURIComponent(slug)}/revisions/${encodeURIComponent(revisionId)}`,
    {},
    CmsRevisionSnapshotSchema,
    "get_revision",
  );

export const restoreRevision = (
  kind: ContentKind,
  slug: string,
  revisionId: string,
): Effect.Effect<CmsPost | CmsWork, CmsError> =>
  Effect.flatMap(
    encodeBody(() => Schema.encodeSync(restoreInputJson)({ revisionId }), "restore_revision"),
    (body): Effect.Effect<CmsPost | CmsWork, CmsError> =>
      kind === "posts"
        ? fetchAndDecode(
            `/content/${kind}/${slug}/restore`,
            jsonBody(body),
            CmsPostSchema,
            "restore_revision",
          )
        : fetchAndDecode(
            `/content/${kind}/${slug}/restore`,
            jsonBody(body),
            CmsWorkSchema,
            "restore_revision",
          ),
  );

export const listCategories = (): Effect.Effect<ReadonlyArray<CmsCategory>, CmsError> =>
  fetchAndDecode("/content/categories", {}, categoryListSchema, "list_categories");

export const createCategory = (slug: string, title: string): Effect.Effect<CmsCategory, CmsError> =>
  Effect.flatMap(
    decodeResponse(
      CmsCategoryInputSchema,
      { slug, title },
      "create_category",
      "Invalid category data",
    ),
    (input) =>
      Effect.flatMap(
        encodeBody(() => Schema.encodeSync(categoryInputJson)(input), "create_category"),
        (body) =>
          fetchAndDecode(
            "/content/categories",
            jsonBody(body),
            CmsCategorySchema,
            "create_category",
          ),
      ),
  );

export const deleteCategory = (slug: string): Effect.Effect<{ readonly id: string }, CmsError> =>
  fetchAndDecode(
    `/content/categories/${encodeURIComponent(slug)}`,
    { method: "DELETE" },
    deleteResultSchema,
    "delete_category",
  );

/** Upload a file; the browser sets the multipart boundary itself. */
export const uploadMedia = (file: File, alt: string | null): Effect.Effect<CmsMedia, CmsError> => {
  const form = new FormData();
  form.append("file", file);
  if (alt !== null) form.append("alt", alt);
  return fetchAndDecode(
    "/content/media",
    { method: "POST", body: form },
    CmsMediaSchema,
    "upload_media",
  );
};

export const listMedia = (): Effect.Effect<CmsListResponse<CmsMedia>, CmsError> =>
  fetchAndDecode("/content/media?pageSize=100", {}, mediaListSchema, "list_media");

export const getMediaUsage = (id: string): Effect.Effect<CmsMediaUsage, CmsError> =>
  fetchAndDecode(
    `/content/media/${encodeURIComponent(id)}/usage`,
    {},
    CmsMediaUsageSchema,
    "get_media_usage",
  );

export const deleteMedia = (id: string): Effect.Effect<{ readonly id: string }, CmsError> =>
  fetchAndDecode(
    `/content/media/${encodeURIComponent(id)}`,
    { method: "DELETE" },
    deleteResultSchema,
    "delete_media",
  );

/** Display filename from a storage key (`media/<id>/<name>`). */
export const mediaFileName = (key: string): string => {
  const name = key.split("/").pop();
  return name === undefined || name === "" ? key : name;
};

export type ContentFields = {
  readonly slug: string;
  readonly title: string;
  readonly summary: string;
  readonly status: CmsStatus;
  readonly publishedAt: string;
};

/** Meta tags derive from the post itself; the editor sends nulls. */
const emptyMeta = { title: null, description: null, image: null };

const nullIfEmpty = (value: string): string | null => (value === "" ? null : value);

/** Build a validated post input from form fields; fails before any network call. */
export const toPostInput = (
  fields: ContentFields,
  doc: TiptapDoc,
  categoryIds: ReadonlyArray<string>,
): Effect.Effect<CmsPostInput, CmsError> =>
  decodeResponse(
    CmsPostInputSchema,
    {
      slug: fields.slug,
      title: fields.title,
      summary: nullIfEmpty(fields.summary),
      content: doc,
      status: fields.status,
      publishedAt: nullIfEmpty(fields.publishedAt),
      heroMediaId: null,
      categoryIds,
      meta: emptyMeta,
    },
    "save_post",
    "Invalid post data",
  );

/** Build a validated work input from form fields; fails before any network call. */
export const toWorkInput = (
  fields: ContentFields,
  doc: TiptapDoc,
): Effect.Effect<CmsWorkInput, CmsError> =>
  decodeResponse(
    CmsWorkInputSchema,
    {
      slug: fields.slug,
      title: fields.title,
      summary: nullIfEmpty(fields.summary),
      content: doc,
      status: fields.status,
      publishedAt: nullIfEmpty(fields.publishedAt),
      heroMediaId: null,
      meta: emptyMeta,
    },
    "save_work",
    "Invalid work data",
  );

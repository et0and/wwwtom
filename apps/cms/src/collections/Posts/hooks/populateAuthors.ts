import type { CollectionAfterReadHook } from "payload";
import { Effect } from "effect";
import { Post, User } from "src/payload-types";

// The `user` collection has access control locked so that users are not publicly accessible
// This means that we need to populate the authors manually here to protect user privacy
// GraphQL will not return mutated user data that differs from the underlying schema
// So we use an alternative `populatedAuthors` field to populate the user data, hidden from the admin UI
export const populateAuthors: CollectionAfterReadHook<Post> = async ({ doc, req: { payload } }) => {
  if (!doc?.authors?.length) return doc;

  const loadAuthor = (author: number | User) =>
    Effect.tryPromise(() =>
      payload.findByID({
        id: author instanceof Object ? author.id : author,
        collection: "users",
        depth: 0,
      }),
    ).pipe(
      // A failed author lookup must not fail the whole read; the populated
      // field is best-effort.
      Effect.catch((error) => {
        payload.logger.debug(`Failed to populate author: ${error}`);
        return Effect.succeed(undefined);
      }),
    );

  const authorDocs = await Effect.runPromise(
    Effect.all(doc.authors.map(loadAuthor), { concurrency: "unbounded" }),
  );

  const populatedAuthors = authorDocs.flatMap((authorDoc) =>
    authorDoc ? [{ id: String(authorDoc.id), name: authorDoc.name }] : [],
  );

  if (populatedAuthors.length > 0) {
    doc.populatedAuthors = populatedAuthors;
  }

  return doc;
};

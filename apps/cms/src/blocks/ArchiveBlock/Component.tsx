import type { Post, Category, ArchiveBlock as ArchiveBlockProps } from "@/payload-types";

import configPromise from "@payload-config";
import { getPayload } from "payload";
import React from "react";
import RichText from "@/components/RichText";

import { CollectionArchive } from "@/components/CollectionArchive";
import { isPopulated } from "@/utilities/isPopulated";

export const ArchiveBlock: React.FC<
  ArchiveBlockProps & {
    id?: string;
  }
> = async (props) => {
  const { id, categories, introContent, limit: limitFromProps, populateBy, selectedDocs } = props;

  const limit = limitFromProps || 3;

  let posts: Post[] = [];

  if (populateBy === "collection") {
    const payload = await getPayload({ config: configPromise });

    const flattenedCategories = categories?.map((category) =>
      isPopulated<Category>(category) ? category.id : category,
    );

    const where =
      flattenedCategories && flattenedCategories.length > 0
        ? {
            categories: {
              in: flattenedCategories,
            },
          }
        : undefined;

    const fetchedPosts = await payload.find({
      collection: "posts",
      depth: 1,
      limit,
      where,
    });

    posts = fetchedPosts.docs;
  } else {
    if (selectedDocs?.length) {
      posts = selectedDocs
        .map((doc) => doc.value)
        .filter((value): value is Post => isPopulated(value));
    }
  }

  return (
    <div className="my-16" id={`block-${id}`}>
      {introContent && (
        <div className="container mb-16">
          <RichText className="ms-0 max-w-[48rem]" data={introContent} enableGutter={false} />
        </div>
      )}
      <CollectionArchive posts={posts} />
    </div>
  );
};

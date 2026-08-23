import Link from "next/link";
import { notFound } from "next/navigation";
import { SideBySide } from "../../../../components/SideBySide";
import { RichText } from "@payloadcms/richtext-lexical/react";
import type { Metadata } from "next";
import { siteNav } from "../../site-config";
import { getPublishedPostBySlug } from "../post-data";
import { isPopulated } from "../../../../utilities/isPopulated";

import type { Post, ContentBlock, ImageBlock, YouTubeBlock } from "../../../../payload-types";

export async function generateMetadata(props: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const params = await props.params;
  const post = await getPublishedPostBySlug(params.slug);
  if (!post) {
    return { title: "Post Not Found" };
  }

  const metaTitle = post.meta?.title ?? post.title;
  const metaDescription = post.meta?.description ?? post.excerpt;
  const metaImage = isPopulated(post.meta?.image)
    ? post.meta.image
    : isPopulated(post.featuredImage)
      ? post.featuredImage
      : null;

  return {
    title: metaTitle,
    description: metaDescription,
    openGraph: {
      title: metaTitle ?? undefined,
      description: metaDescription ?? undefined,
      images: metaImage?.url ? [{ url: metaImage.url, alt: metaImage.alt }] : undefined,
      type: "article",
    },
    twitter: {
      title: metaTitle ?? undefined,
      description: metaDescription ?? undefined,
      images: metaImage?.url ? [{ url: metaImage.url, alt: metaImage.alt }] : undefined,
    },
  };
}

const extractYouTubeId = (url: string): string | null => {
  const patterns = [
    /youtube\.com\/watch\?v=([a-zA-Z0-9_-]+)/,
    /youtu\.be\/([a-zA-Z0-9_-]+)/,
    /youtube\.com\/embed\/([a-zA-Z0-9_-]+)/,
    /m\.youtube\.com\/watch\?v=([a-zA-Z0-9_-]+)/,
  ];

  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match?.[1]) {
      return match[1];
    }
  }
  return null;
};

const getAspectRatioClass = (ratio: "16:9" | "4:3" | "1:1" | null | undefined): string => {
  switch (ratio) {
    case "4:3":
      return "aspect-[4/3]";
    case "1:1":
      return "aspect-square";
    case "16:9":
    default:
      return "aspect-video";
  }
};

const getLayoutClasses = (layout: "full" | "wide" | "centered" | null | undefined): string => {
  switch (layout) {
    case "full":
      return "w-full";
    case "wide":
      return "max-w-4xl mx-auto";
    case "centered":
    default:
      return "max-w-2xl mx-auto";
  }
};

function PostImageBlock({ block }: { block: ImageBlock }) {
  const image = isPopulated(block.image) ? block.image : null;
  if (!image) return null;

  return (
    <figure className={`my-8 ${getLayoutClasses(block.layout)}`}>
      <img src={image.url ?? ""} alt={image.alt} className="w-full h-auto" loading="lazy" />
      {block.caption && (
        <figcaption className="mt-2 text-sm text-gray-500 text-center">{block.caption}</figcaption>
      )}
    </figure>
  );
}

function PostYouTubeBlock({ block }: { block: YouTubeBlock }) {
  const videoId = extractYouTubeId(block.url);
  if (!videoId) {
    return (
      <div className="my-8 p-4 bg-red-50 text-red-600 rounded-lg">
        <p>Invalid YouTube URL: {block.url}</p>
      </div>
    );
  }

  return (
    <figure className={`my-8 ${getLayoutClasses("centered")}`}>
      <div className={`relative ${getAspectRatioClass(block.aspectRatio)}`}>
        <iframe
          src={`https://www.youtube-nocookie.com/embed/${videoId}`}
          title="YouTube video"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
          className="absolute inset-0 w-full h-full rounded-lg"
        />
      </div>
      {block.caption && (
        <figcaption className="mt-2 text-sm text-gray-500 text-center">{block.caption}</figcaption>
      )}
    </figure>
  );
}

function PostContentBlock({ block }: { block: ContentBlock }) {
  if (!block.richText) return null;

  return (
    <div className="my-8 prose prose-lg max-w-none">
      <RichText data={block.richText} />
    </div>
  );
}

function renderContent(content: Post["content"]) {
  return content.map((block, index) => {
    switch (block.blockType) {
      case "content":
        return <PostContentBlock key={block.id ?? index} block={block as ContentBlock} />;
      case "image":
        return <PostImageBlock key={block.id ?? index} block={block as ImageBlock} />;
      case "youtube":
        return <PostYouTubeBlock key={block.id ?? index} block={block as YouTubeBlock} />;
      default:
        return null;
    }
  });
}

export default async function PostPage(props: { params: Promise<{ slug: string }> }) {
  const params = await props.params;
  const post = await getPublishedPostBySlug(params.slug);
  if (!post) {
    notFound();
  }

  return (
    <SideBySide nav={siteNav}>
      <article className="space-y-8">
        <header className="space-y-4">
          <h1 className="text-3xl font-medium">{post.title}</h1>
          <div className="flex flex-wrap gap-3 text-sm text-gray-500">
            {post.author && isPopulated(post.author) && (
              <span>By {post.author.name || post.author.email}</span>
            )}
            {post.category && isPopulated(post.category) && (
              <span>
                <Link
                  href={`/posts?category=${post.category.slug}`}
                  className="hover:text-orange-600 transition-colors"
                >
                  {post.category.title}
                </Link>
              </span>
            )}
            {post.publishedAt && (
              <time dateTime={post.publishedAt}>
                {new Date(post.publishedAt).toLocaleDateString("en-US", {
                  year: "numeric",
                  month: "long",
                  day: "numeric",
                })}
              </time>
            )}
          </div>
          {post.tags && post.tags.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {post.tags.map((tag) => {
                if (!isPopulated(tag)) return null;
                return (
                  <span key={tag.id} className="px-2 py-1 text-xs bg-gray-100 rounded">
                    {tag.title}
                  </span>
                );
              })}
            </div>
          )}
        </header>

        {post.featuredImage && isPopulated(post.featuredImage) && (
          <figure className="py-4">
            <img
              src={post.featuredImage.url ?? ""}
              alt={post.featuredImage.alt}
              className="w-full h-auto rounded-lg"
            />
            {post.featuredImage.alt && (
              <figcaption className="mt-2 text-sm text-gray-500 text-center">
                {post.featuredImage.alt}
              </figcaption>
            )}
          </figure>
        )}

        {post.excerpt && <p className="text-lg text-gray-600">{post.excerpt}</p>}

        <div className="prose prose-lg max-w-none">{renderContent(post.content)}</div>
      </article>
    </SideBySide>
  );
}

import type { Access } from "payload";

// Anyone can read published posts, only authenticated users can read drafts
export const readPosts: Access = ({ req: { user } }) => {
  if (user) return true;

  return {
    status: { equals: "published" },
  };
};

// Authenticated users can create posts
export const createPosts: Access = ({ req: { user } }) => Boolean(user);

// Author or user can update their own posts
export const updatePosts: Access = ({ req: { user } }) => {
  if (!user) return false;

  // User can update their own posts
  return { author: { equals: user.id } };
};

// Only author can delete posts
export const deletePosts: Access = ({ req: { user } }) => {
  if (!user) return false;

  // User can delete their own posts
  return { author: { equals: user.id } };
};

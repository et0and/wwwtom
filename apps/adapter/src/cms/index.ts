import { Elysia } from "elysia";
import { createCategoryRoute } from "./create-content-category";
import { createMediaRoute } from "./create-content-media";
import { createPostRoute } from "./create-content-post";
import { createWorkRoute } from "./create-content-work";
import { deleteCategoryRoute } from "./delete-content-category";
import { deleteMediaRoute } from "./delete-content-media";
import { deletePostRoute } from "./delete-content-post";
import { deleteWorkRoute } from "./delete-content-work";
import { getFeedRoute } from "./get-content-feed";
import { getMediaRoute } from "./get-content-media";
import { getMediaFileRoute } from "./get-content-media-file";
import { getMediaUsageRoute } from "./get-content-media-usage";
import { getPostRoute } from "./get-content-post";
import { getPostRevisionRoute } from "./get-content-post-revision";
import { getWorkRoute } from "./get-content-work";
import { getWorkRevisionRoute } from "./get-content-work-revision";
import { listCategoriesRoute } from "./list-content-categories";
import { listMediaRoute } from "./list-content-media";
import { listPostSummariesRoute } from "./list-content-post-summaries";
import { listPostRevisionsRoute } from "./list-content-post-revisions";
import { listPostsRoute } from "./list-content-posts";
import { listWorkSummariesRoute } from "./list-content-work-summaries";
import { listWorkRevisionsRoute } from "./list-content-work-revisions";
import { listWorksRoute } from "./list-content-works";
import { restorePostRoute } from "./restore-content-post";
import { restoreWorkRoute } from "./restore-content-work";
import { updatePostRoute } from "./update-content-post";
import { updateWorkRoute } from "./update-content-work";

export const cmsIntegration = new Elysia({ name: "cms" })
  .use(listPostsRoute)
  .use(listPostSummariesRoute)
  .use(getPostRoute)
  .use(listWorksRoute)
  .use(listWorkSummariesRoute)
  .use(getWorkRoute)
  .use(listCategoriesRoute)
  .use(getMediaRoute)
  .use(listMediaRoute)
  .use(getMediaUsageRoute)
  .use(getMediaFileRoute)
  .use(getFeedRoute)
  .use(createPostRoute)
  .use(updatePostRoute)
  .use(deletePostRoute)
  .use(listPostRevisionsRoute)
  .use(getPostRevisionRoute)
  .use(restorePostRoute)
  .use(createWorkRoute)
  .use(updateWorkRoute)
  .use(deleteWorkRoute)
  .use(listWorkRevisionsRoute)
  .use(getWorkRevisionRoute)
  .use(restoreWorkRoute)
  .use(createCategoryRoute)
  .use(deleteCategoryRoute)
  .use(createMediaRoute)
  .use(deleteMediaRoute);

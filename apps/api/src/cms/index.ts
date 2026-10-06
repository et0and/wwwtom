import { Elysia } from "elysia";
import { createCategoryRoute } from "./create-category";
import { createMediaRoute } from "./create-media";
import { createPostRoute } from "./create-post";
import { createWorkRoute } from "./create-work";
import { deleteCategoryRoute } from "./delete-category";
import { deleteMediaRoute } from "./delete-media";
import { deletePostRoute } from "./delete-post";
import { deleteWorkRoute } from "./delete-work";
import { getMediaRoute } from "./get-media";
import { getMediaUsageRoute } from "./get-media-usage";
import { getPostRoute } from "./get-post";
import { getPostRevisionRoute } from "./get-post-revision";
import { getWorkRoute } from "./get-work";
import { getWorkRevisionRoute } from "./get-work-revision";
import { listCategoriesRoute } from "./list-categories";
import { listMediaRoute } from "./list-media";
import { listPostSummariesRoute } from "./list-post-summaries";
import { listPostRevisionsRoute } from "./list-post-revisions";
import { listPostsRoute } from "./list-posts";
import { listWorkSummariesRoute } from "./list-work-summaries";
import { listWorkRevisionsRoute } from "./list-work-revisions";
import { listWorksRoute } from "./list-works";
import { mediaFileRoute } from "./get-media-file";
import { restorePostRevisionRoute } from "./restore-post-revision";
import { restoreWorkRevisionRoute } from "./restore-work-revision";
import { updatePostRoute } from "./update-post";
import { updateWorkRoute } from "./update-work";

export const cmsRoutes = new Elysia({ name: "cms" })
  .use(listPostsRoute)
  .use(listPostSummariesRoute)
  .use(getPostRoute)
  .use(listWorksRoute)
  .use(listWorkSummariesRoute)
  .use(getWorkRoute)
  .use(listCategoriesRoute)
  .use(getMediaRoute)
  .use(mediaFileRoute);

export const cmsWriteRoutes = new Elysia({ name: "cms-writes" })
  .use(createPostRoute)
  .use(updatePostRoute)
  .use(deletePostRoute)
  .use(createWorkRoute)
  .use(updateWorkRoute)
  .use(deleteWorkRoute)
  .use(listPostRevisionsRoute)
  .use(getPostRevisionRoute)
  .use(restorePostRevisionRoute)
  .use(listWorkRevisionsRoute)
  .use(getWorkRevisionRoute)
  .use(restoreWorkRevisionRoute)
  .use(createCategoryRoute)
  .use(deleteCategoryRoute)
  .use(createMediaRoute)
  .use(deleteMediaRoute)
  .use(listMediaRoute)
  .use(getMediaUsageRoute);

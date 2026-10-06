import { Elysia } from "elysia";
import { getMediaRoute } from "./get-media";
import { getPostRoute } from "./get-post";
import { getWorkRoute } from "./get-work";
import { listCategoriesRoute } from "./list-categories";
import { listPostSummariesRoute } from "./list-post-summaries";
import { listPostsRoute } from "./list-posts";
import { listWorkSummariesRoute } from "./list-work-summaries";
import { listWorksRoute } from "./list-works";
import { mediaFileRoute } from "./get-media-file";

export const cmsSimulator = new Elysia({ name: "cms-simulator" })
  .use(listPostsRoute)
  .use(listPostSummariesRoute)
  .use(getPostRoute)
  .use(listWorksRoute)
  .use(listWorkSummariesRoute)
  .use(getWorkRoute)
  .use(listCategoriesRoute)
  .use(getMediaRoute)
  .use(mediaFileRoute);

import { Elysia } from "elysia";

import { getMangaArchiveRoute } from "./get-manga-archive";
import { getMangaManifestRoute } from "./get-manga-manifest";

export const mangaIntegration = new Elysia({ name: "manga" })
  .use(getMangaManifestRoute)
  .use(getMangaArchiveRoute);

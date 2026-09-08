import { useParams } from "@solidjs/router";
import { httpHeader } from "@solidjs/web";
import { createMemo } from "solid-js";
import { CanvasChannel } from "~/components/Canvas/CanvasChannel";

export default function CanvasPage() {
  const params = useParams();
  const slug = createMemo(() => params.slug ?? "");

  httpHeader("Cache-Control", "public, max-age=600, s-maxage=3600, stale-while-revalidate=86400");
  httpHeader("CDN-Cache-Control", "public, max-age=3600, stale-while-revalidate=86400");

  return (
    <div class="h-dvh w-full overflow-hidden">
      <CanvasChannel slug={slug()} />
    </div>
  );
}

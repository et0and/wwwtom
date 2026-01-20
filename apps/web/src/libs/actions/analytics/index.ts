import { action } from "@solidjs/router";
import { runServerEffect } from "@tom/utils";
import { Effect } from "effect";
import { incrementPageView } from "@tom/analytics";
import { AnalyticsError } from "@tom/types";

export const incrementPageViewAction = action(async (formData: FormData) => {
  "use server";
  const path = formData.get("path")?.toString();
  if (!path) {
    return { success: false, error: "Missing path" };
  }

  await runServerEffect(
    Effect.tryPromise({
      try: (_signal) => incrementPageView(path),
      catch: (cause) => new AnalyticsError({ message: "Failed to increment page view", operation: "incrementPageView", cause }),
    }).pipe(Effect.ignore),
  );

  return { success: true };
}, "increment-page-view");

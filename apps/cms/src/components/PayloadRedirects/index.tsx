import type React from "react";

import { getCachedRedirects } from "@/utilities/getRedirects";
import { notFound, redirect } from "next/navigation";

interface Props {
  disableNotFound?: boolean;
  url: string;
}

/* This component helps us with SSR based dynamic redirects */
export const PayloadRedirects: React.FC<Props> = async ({ disableNotFound, url }) => {
  const redirects = await getCachedRedirects()();

  const redirectItem = redirects.find((redirect) => redirect.from === url);

  if (redirectItem) {
    if (redirectItem.to?.url) {
      redirect(redirectItem.to.url);
    }

    let redirectUrl = "";

    const reference = redirectItem.to?.reference;
    const prefix = reference?.relationTo !== "pages" ? `/${reference?.relationTo}` : "";

    // Redirects are fetched with depth 1, so the reference value is the
    // populated document; unpopulated ids cannot be resolved to a slug.
    if (reference?.value instanceof Object) {
      redirectUrl = `${prefix}/${reference.value.slug}`;
    }

    if (redirectUrl) redirect(redirectUrl);
  }

  if (disableNotFound) return null;

  notFound();
};

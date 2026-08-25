import type React from "react";
import type { Page, Post } from "@/payload-types";

import { getCachedDocument } from "@/utilities/getDocument";
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

    const reference = redirectItem.to?.reference;

    let redirectUrl: string;

    if (reference && !(reference.value instanceof Object)) {
      const document = (await getCachedDocument(
        reference.relationTo,
        String(reference.value),
      )()) as Page | Post;
      redirectUrl = `${reference.relationTo !== "pages" ? `/${reference.relationTo}` : ""}/${document?.slug}`;
    } else {
      redirectUrl = `${reference?.relationTo !== "pages" ? `/${reference?.relationTo}` : ""}/${
        reference && reference.value instanceof Object ? reference.value.slug : ""
      }`;
    }

    if (redirectUrl) redirect(redirectUrl);
  }

  if (disableNotFound) return null;

  notFound();
};

import type { CollectionConfig } from "payload";
import type { PayloadRequest } from "payload";
import { renderForgotPasswordEmail, renderVerificationEmail } from "@tom/email";

type RenderedAuthEmail = Awaited<ReturnType<typeof renderVerificationEmail>>;

type CachedRenderedAuthEmail = {
  email: Promise<RenderedAuthEmail>;
  createdAt: number;
};

const AUTH_EMAIL_CACHE_TTL_MS = 60_000;
const authEmailCache = new Map<string, CachedRenderedAuthEmail>();

const resolveServerURL = (req: PayloadRequest): string => {
  if (req.payload.config.serverURL) return req.payload.config.serverURL;

  const host = req.headers.get("host");

  if (!host) {
    throw new Error("Unable to build auth email URL because request host is missing");
  }

  return `${new URL(req.url).protocol}//${host}`;
};

const normalizeAdminRoute = (adminRoute: string): string => {
  if (!adminRoute) return "/admin";
  if (adminRoute === "/") return "";
  return adminRoute.startsWith("/") ? adminRoute : `/${adminRoute}`;
};

const buildAuthEmailURL = (req: PayloadRequest, authPath: string): string => {
  if (!authPath.startsWith("/")) {
    throw new Error(`Auth email path must start with '/': ${authPath}`);
  }

  const adminRoute = normalizeAdminRoute(req.payload.config.routes.admin);
  return new URL(`${adminRoute}${authPath}`, resolveServerURL(req)).toString();
};

const pruneAuthEmailCache = (now: number): void => {
  for (const [cacheKey, cacheEntry] of authEmailCache.entries()) {
    if (now - cacheEntry.createdAt <= AUTH_EMAIL_CACHE_TTL_MS) continue;
    authEmailCache.delete(cacheKey);
  }
};

const getCachedAuthEmail = (
  cacheKey: string,
  render: () => Promise<RenderedAuthEmail>,
): Promise<RenderedAuthEmail> => {
  const now = Date.now();
  pruneAuthEmailCache(now);

  const cachedEntry = authEmailCache.get(cacheKey);
  if (cachedEntry) return cachedEntry.email;

  const email = render();
  authEmailCache.set(cacheKey, {
    email,
    createdAt: now,
  });

  email.catch(() => {
    authEmailCache.delete(cacheKey);
  });

  return email;
};

const getUserName = (user: unknown): string | undefined => {
  if (!user || typeof user !== "object") return undefined;
  if (!("name" in user)) return undefined;

  const userName = user.name;
  if (typeof userName !== "string") return undefined;
  if (!userName.trim()) return undefined;

  return userName;
};

const requireForgotPasswordArgs = (
  args: { req?: PayloadRequest; token?: string; user?: unknown } | undefined,
): { req: PayloadRequest; token: string; user: unknown } => {
  if (!args?.req || !args.token || !args.user) {
    throw new Error("Missing forgot-password email context from Payload auth flow");
  }

  return {
    req: args.req,
    token: args.token,
    user: args.user,
  };
};

const getVerificationEmail = (
  req: PayloadRequest,
  token: string,
  user: unknown,
): Promise<RenderedAuthEmail> => {
  const verificationUrl = buildAuthEmailURL(req, `/users/verify/${encodeURIComponent(token)}`);
  const recipientName = getUserName(user);
  const cacheKey = `verify:${verificationUrl}:${recipientName ?? ""}`;

  return getCachedAuthEmail(cacheKey, () =>
    renderVerificationEmail({
      verificationUrl,
      recipientName,
    }),
  );
};

const getForgotPasswordEmail = (
  req: PayloadRequest,
  token: string,
  user: unknown,
): Promise<RenderedAuthEmail> => {
  const resetUrl = buildAuthEmailURL(
    req,
    `${req.payload.config.admin.routes.reset}/${encodeURIComponent(token)}`,
  );
  const recipientName = getUserName(user);
  const cacheKey = `forgot:${resetUrl}:${recipientName ?? ""}`;

  return getCachedAuthEmail(cacheKey, () =>
    renderForgotPasswordEmail({
      resetUrl,
      recipientName,
    }),
  );
};

export const Users: CollectionConfig = {
  slug: "users",
  admin: {
    useAsTitle: "name",
  },
  access: {
    admin: ({ req }) => {
      if (!req.user) return false;
      return req.user._verified === true;
    },
  },
  auth: {
    verify: {
      generateEmailSubject: async ({ req, token, user }) => {
        const email = await getVerificationEmail(req, token, user);

        return email.subject;
      },
      generateEmailHTML: async ({ req, token, user }) => {
        const email = await getVerificationEmail(req, token, user);

        return email.html;
      },
    },
    forgotPassword: {
      generateEmailSubject: async (args) => {
        const context = requireForgotPasswordArgs(args);
        const email = await getForgotPasswordEmail(context.req, context.token, context.user);

        return email.subject;
      },
      generateEmailHTML: async (args) => {
        const context = requireForgotPasswordArgs(args);
        const email = await getForgotPasswordEmail(context.req, context.token, context.user);

        return email.html;
      },
    },
  },
  hooks: {
    beforeChange: [
      ({ data, operation, req }) => {
        if (!data || typeof data !== "object") return data;

        if (operation === "create") {
          return {
            ...data,
            _verified: false,
            _verificationToken: undefined,
          };
        }

        if (operation !== "update") return data;
        if (!req.user) return data;
        if (!("_verified" in data) && !("_verificationToken" in data)) return data;

        return {
          ...data,
          _verified: undefined,
          _verificationToken: undefined,
        };
      },
    ],
  },
  fields: [
    {
      name: "name",
      type: "text",
      required: false,
    },
    // Email added by default
    // Add more fields as needed
  ],
};

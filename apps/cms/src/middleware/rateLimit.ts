import type { PayloadRequest } from "payload";

const rateLimitStore = new Map<string, { count: number; resetTime: number }>();

export const rateLimitMiddleware = (req: PayloadRequest) => {
  const clientIp = req.headers.get("x-forwarded-for") || req.headers.get("x-real-ip") || "unknown";

  const now = Date.now();
  const windowMs = 15 * 60 * 1000; // 15 minutes
  const maxRequests = 100; // requests per window per IP

  const current = rateLimitStore.get(clientIp);

  if (!current || now > current.resetTime) {
    rateLimitStore.set(clientIp, {
      count: 1,
      resetTime: now + windowMs,
    });
    return;
  }

  if (current.count >= maxRequests) {
    throw new Error("Rate limit exceeded");
  }

  current.count++;
};

import type { PayloadRequest } from "payload";

// Simple in-memory rate limiting for development
const rateLimitStore = new Map<string, { count: number; resetTime: number }>();

export const apiSecurityMiddleware = (req: PayloadRequest) => {
  // Skip security for authenticated users
  if (req.user) {
    return;
  }

  const clientIp = req.headers.get("x-forwarded-for") || req.headers.get("x-real-ip") || "unknown";

  const now = Date.now();
  const windowMs = 15 * 60 * 1000; // 15 minutes
  const maxRequests = 200; // requests per window per IP

  const current = rateLimitStore.get(clientIp);

  if (!current || now > current.resetTime) {
    rateLimitStore.set(clientIp, {
      count: 1,
      resetTime: now + windowMs,
    });
    return;
  }

  if (current.count >= maxRequests) {
    throw new Error("Rate limit exceeded. Please try again later.");
  }

  current.count++;

  // Clean up old entries periodically
  if (Math.random() < 0.01) {
    // 1% chance to clean up
    for (const [ip, data] of rateLimitStore.entries()) {
      if (now > data.resetTime) {
        rateLimitStore.delete(ip);
      }
    }
  }
};

import type { Access } from "payload";

export const frontendOnly: Access = ({ req }) => {
  // Allow access if user is authenticated (admin users)
  if (req.user) {
    return true;
  }

  // Check for API key if configured
  const apiKey = req.headers.get("x-api-key");
  if (apiKey && apiKey === process.env.PAYLOAD_API_KEY) {
    return true;
  }

  // Get the origin from the request
  const origin = req.headers.get("origin");
  const referer = req.headers.get("referer");
  const host = req.headers.get("host");

  // Get allowed domains from environment variables
  const allowedDomainsEnv = process.env.ALLOWED_FRONTEND_DOMAINS;
  const allowedDomains = allowedDomainsEnv
    ? allowedDomainsEnv.split(",").map((domain) => domain.trim())
    : ["http://localhost:3000", "https://tom.so", "https://www.tom.so"];

  // Debug logging
  console.log("Access check:", {
    origin,
    referer,
    host,
    allowedDomains,
    userAgent: req.headers.get("user-agent"),
  });

  // Check if the request is from an allowed domain
  const isAllowedOrigin = origin && allowedDomains.some((domain) => origin.startsWith(domain));
  const isAllowedReferer = referer && allowedDomains.some((domain) => referer.startsWith(domain));
  const isAllowedHost = host && (host.includes("localhost:3000") || host.includes("tom.so"));

  // Allow access if any of the checks pass
  if (isAllowedOrigin || isAllowedReferer || isAllowedHost) {
    console.log("Access granted");
    return true;
  }

  // For development, allow localhost requests without origin
  if (process.env.NODE_ENV === "development" && host && host.includes("localhost")) {
    console.log("Development access granted");
    return true;
  }

  console.log("Access denied");
  // Block all other requests
  return false;
};

/// <reference types="@solidjs/vite-plugin/boundary-modules" />
/// <reference types="@solidjs/vite-plugin/virtual-modules" />

interface CloudflareEnv {
  ADAPTER_URL?: string;
  AXIOM_TOKEN?: string;
  OTEL_ENDPOINT?: string;
  LOG_LEVEL?: string;
  TOM_SECRETS?: string;
}

export interface TomuiVariantEntry {
  classes?: string | undefined;
  value?: string | number | undefined;
  description?: string | undefined;
}

export function resolveVariant<T extends Record<string, TomuiVariantEntry>>(
  variants: T,
  key: string,
  fallback: keyof T & string,
): T[keyof T] {
  const config: T[keyof T] | undefined = variants[key as keyof T];
  if (config !== undefined) return config;
  return variants[fallback];
}

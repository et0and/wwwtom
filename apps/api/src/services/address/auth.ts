const textEncoder = new TextEncoder();

const toHex = (bytes: Uint8Array): string =>
  Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");

export const hashApiKey = async (key: string, salt: string): Promise<string> => {
  const data = textEncoder.encode(`${salt}:${key}`);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return toHex(new Uint8Array(digest));
};

export const generateApiKey = (): string => {
  const bytes = crypto.getRandomValues(new Uint8Array(24));
  return toHex(bytes);
};

export const sha256Hex = async (message: string): Promise<string> => {
  const digest = await crypto.subtle.digest("SHA-256", textEncoder.encode(message));
  return toHex(new Uint8Array(digest));
};

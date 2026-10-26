/**
 * Constant-time string comparison for shared secrets and webhook tokens.
 * WebCrypto has no timingSafeEqual on Workers, so compare char codes and OR
 * the differences; unequal lengths short-circuit without leaking content.
 */
export const timingSafeEqual = (a: string, b: string): boolean => {
  if (a.length !== b.length) return false;
  const difference = Array.from(
    a,
    (char, index) => char.charCodeAt(0) ^ b.charCodeAt(index),
  ).reduce((acc, code) => acc | code, 0);
  return difference === 0;
};

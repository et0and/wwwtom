/**
 * Extracts the first error message from a form-submissions API response.
 * The response shape is untrusted (fetch result), so this parser is the
 * boundary between the wire format and the UI.
 */
export const firstErrorMessage = <T>(response: T): string => {
  if (!(response instanceof Object) || !("errors" in response)) {
    return "Internal Server Error";
  }
  const errors: unknown = response.errors;
  if (!Array.isArray(errors) || !(errors[0] instanceof Object) || !("message" in errors[0])) {
    return "Internal Server Error";
  }
  const message: unknown = errors[0].message;
  // oxlint-disable-next-line anti-slop/no-runtime-typeof -- required: validating an untrusted field of the API response at its parse boundary
  return typeof message === "string" ? message : "Internal Server Error";
};

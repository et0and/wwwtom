const indentation = (line: string): string => line.slice(0, line.length - line.trimStart().length);

const commonPrefix = (left: string, right: string): string => {
  const length = left.split("").findIndex((character, index) => character !== right[index]);
  return length === -1 ? left : left.slice(0, length);
};

/**
 * Strip the common indentation from a block of text and trim blank leading and
 * trailing lines. Definitions write scripts and descriptions as indented
 * template literals; YAML renders them as block scalars. Comparing leading
 * whitespace as a prefix (not a character count) keeps mixed tabs and spaces
 * from silently mangling the body.
 */
export const dedent = (value: string): string => {
  const lines = value.replaceAll("\r\n", "\n").split("\n");
  const indents = lines.filter((line) => line.trim().length > 0).map(indentation);
  if (indents.length === 0) return "";
  const margin = indents.reduce(commonPrefix);
  const dedented = lines.map((line) =>
    line.startsWith(margin) ? line.slice(margin.length) : line,
  );
  const firstContent = dedented.findIndex((line) => line.trim().length > 0);
  const lastContent = dedented.findLastIndex((line) => line.trim().length > 0);
  return dedented.slice(firstContent, lastContent + 1).join("\n");
};

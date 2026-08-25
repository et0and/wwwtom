const MARKER_RE = /\s*\[alchemy:stack=([^;]+);stage=([^;]+);id=([^\]]+)\]\s*$/;

export const buildMarker = (stack: string, stage: string, id: string): string =>
  `[alchemy:stack=${stack};stage=${stage};id=${id}]`;

export const stripMarker = (value: string | undefined): string => {
  if (!value) return "";
  return value.replace(MARKER_RE, "").trimEnd();
};

export const augmentNotes = (notes: string | undefined, marker: string): string => {
  const base = stripMarker(notes);
  return base.length > 0 ? `${base}\n${marker}` : marker;
};

export const parseMarker = (
  value: string | undefined,
): { stack: string; stage: string; id: string } | undefined => {
  if (!value) return undefined;
  const m = value.match(MARKER_RE);
  if (!m) return undefined;
  return { stack: m[1]!, stage: m[2]!, id: m[3]! };
};

export const isOwnedMarker = (
  notes: string | undefined,
  stack: string,
  stage: string,
  id: string,
): boolean => {
  const parsed = parseMarker(notes);
  return (
    parsed !== undefined && parsed.stack === stack && parsed.stage === stage && parsed.id === id
  );
};

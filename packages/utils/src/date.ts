import { Option, Schema } from "effect";

const dayFormatter = new Intl.DateTimeFormat("en-NZ", {
  year: "numeric",
  month: "long",
  day: "numeric",
});

const dateTimeFormatter = new Intl.DateTimeFormat("en-NZ", {
  year: "numeric",
  month: "long",
  day: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});

const toDate = (value: string | Date | null | undefined): Date | undefined => {
  if (value === null || value === undefined) return undefined;
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? undefined : value;
  const parsed = Schema.decodeOption(Schema.DateFromString)(value);
  return Option.isNone(parsed) ? undefined : parsed.value;
};

export const formatDate = (value: string | Date | null | undefined): string => {
  const date = toDate(value);
  return date === undefined ? "" : dayFormatter.format(date);
};

export const formatDateTime = (value: string | Date | null | undefined): string => {
  const date = toDate(value);
  return date === undefined ? "" : dateTimeFormatter.format(date);
};

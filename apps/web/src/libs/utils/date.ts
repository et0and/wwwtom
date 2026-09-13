const dayOptions: Intl.DateTimeFormatOptions = {
  year: "numeric",
  month: "long",
  day: "numeric",
};

const dateTimeOptions: Intl.DateTimeFormatOptions = {
  ...dayOptions,
  hour: "2-digit",
  minute: "2-digit",
};

export const formatDate = (value: string | Date): string =>
  new Date(value).toLocaleDateString("en-NZ", dayOptions);

export const formatDateTime = (value: string | Date): string =>
  new Date(value).toLocaleDateString("en-NZ", dateTimeOptions);

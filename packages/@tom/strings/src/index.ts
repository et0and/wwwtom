export type InterpolationMap = Record<string, string | number>;

export type StringsDict<T extends Record<string, string>> = {
  t(key: keyof T, interpolations?: InterpolationMap): string;
};

export function createStringsDict<T extends Record<string, string>>(phrases: T): StringsDict<T> {
  return {
    t(key, interpolations) {
      const template = phrases[key];
      if (template === undefined) return String(key);
      return interpolate(template, interpolations);
    },
  };
}

function interpolate(template: string, values?: InterpolationMap): string {
  if (values === undefined) return template;
  return template.replace(/\{(\w+)\}/g, (_, key) => {
    if (key in values) return String(values[key]);
    return `{${key}}`;
  });
}

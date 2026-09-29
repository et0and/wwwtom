/** One value of a variant group, carrying its Tailwind classes and docs. */
export type RegistryVariantValue = {
  readonly name: string;
  readonly classes: string;
  readonly description: string | null;
};

/** A variant axis such as `variant`, `size` or `appearance`. */
export type RegistryVariantGroup = {
  readonly name: string;
  readonly values: ReadonlyArray<RegistryVariantValue>;
};

/** Everything the plugin needs to build a Figma ComponentSet for one component. */
export type RegistryEntry = {
  readonly name: string;
  readonly slug: string;
  readonly exportPrefix: string;
  readonly baseStyles: string | null;
  readonly variants: ReadonlyArray<RegistryVariantGroup>;
  readonly defaults: Readonly<Record<string, string>>;
  readonly parts: ReadonlyArray<string>;
};

/** Which part of a component receives a variant group's classes. */
export type AnatomyRole = "root" | "label" | "box" | "track" | "thumb" | "dot" | "bar";

export type AnatomyNode = {
  readonly role: AnatomyRole;
  readonly kind: "frame" | "text" | "ellipse";
  readonly text?: string;
  readonly classes?: string;
  readonly children?: ReadonlyArray<AnatomyNode>;
};

export type Anatomy = {
  readonly root: AnatomyNode;
  readonly targets: Readonly<Record<string, AnatomyRole>>;
};

function label(text: string, classes?: string): AnatomyNode {
  return classes === undefined
    ? { role: "label", kind: "text", text }
    : { role: "label", kind: "text", text, classes };
}

function root(children: ReadonlyArray<AnatomyNode>, classes?: string): AnatomyNode {
  return classes === undefined
    ? { role: "root", kind: "frame", children }
    : { role: "root", kind: "frame", children, classes };
}

function pickAnatomy<T extends Readonly<Record<string, Anatomy>>>(
  table: T,
  key: string,
): Anatomy | undefined {
  return Object.hasOwn(table, key) ? table[key] : undefined;
}

const ANATOMIES = {
  button: {
    root: root([label("Button")]),
    targets: {},
  },
  badge: {
    root: root([label("Badge")]),
    targets: {},
  },
  banner: {
    root: root([label("Banner title")]),
    targets: {},
  },
  input: {
    root: root([label("Placeholder", "text-tomui-placeholder")], "w-60"),
    targets: {},
  },
  select: {
    root: root([label("Select", "text-tomui-default")], "w-50"),
    targets: {},
  },
  text: {
    root: { role: "root", kind: "text", text: "The quick brown fox" },
    targets: {},
  },
  link: {
    root: { role: "root", kind: "text", text: "Read more" },
    targets: {},
  },
  label: {
    root: { role: "root", kind: "text", text: "Label" },
    targets: {},
  },
  code: {
    root: root([label("const answer = 42")]),
    targets: {},
  },
  loader: {
    root: root([], "size-4 rounded-full ring-2 ring-tomui-line"),
    targets: {},
  },
  meter: {
    root: root([
      label("Meter"),
      {
        role: "bar",
        kind: "frame",
        classes: "h-2 w-40 rounded-full bg-tomui-fill",
        children: [],
      },
    ]),
    targets: {},
  },
  checkbox: {
    root: root([
      {
        role: "box",
        kind: "frame",
        classes: "size-3.5 rounded-sm ring ring-tomui-line bg-tomui-base",
        children: [],
      },
      label("Checkbox"),
    ]),
    targets: { variant: "box" },
  },
  switch: {
    root: root([
      {
        role: "track",
        kind: "frame",
        classes: "flex h-5 w-9 items-center rounded-full bg-tomui-fill px-0.5",
        children: [{ role: "thumb", kind: "ellipse", classes: "size-4 bg-tomui-base" }],
      },
      label("Switch"),
    ]),
    targets: { size: "track", variant: "track" },
  },
  radio: {
    root: root([
      {
        role: "dot",
        kind: "ellipse",
        classes: "size-4 rounded-full ring ring-tomui-line",
      },
      label("Option"),
    ]),
    targets: { variant: "dot" },
  },
  empty: {
    root: root([label("Nothing here")], "flex-col items-center gap-2"),
    targets: {},
  },
} satisfies Readonly<Record<string, Anatomy>>;

export function anatomyFor(slug: string, name: string): Anatomy {
  const found = pickAnatomy(ANATOMIES, slug);
  if (found !== undefined) return found;
  return { root: root([label(name)]), targets: {} };
}

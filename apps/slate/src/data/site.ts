export type IconName =
  | "aperture"
  | "archive"
  | "arrow-left"
  | "arrow-right"
  | "arrow-up-right"
  | "check"
  | "chevron-left"
  | "chevron-right"
  | "download"
  | "drive"
  | "film"
  | "folder"
  | "grid"
  | "layers"
  | "play"
  | "printer"
  | "sheet"
  | "sliders"
  | "spark"
  | "star"
  | "tag";

export interface Feature {
  readonly icon: IconName;
  readonly title: string;
  readonly body: string;
}

export interface UseCase {
  readonly title: string;
  readonly body: string;
}

export interface ShowcaseCard {
  readonly tone: "green" | "orange" | "blue" | "pink";
  readonly icon: IconName;
  readonly eyebrow: string;
  readonly title: string;
  readonly body: string;
}

export const links = {
  github: "https://github.com/et0and/slate",
  releases: "https://github.com/et0and/slate/releases/latest",
  readme: "https://github.com/et0and/slate#readme",
  drive: "https://github.com/et0and/slate/blob/main/docs/google-drive.md",
  license: "https://github.com/et0and/slate/blob/main/LICENSE",
  website: "https://tom.so/work/slate",
} as const;

export const forRow: ReadonlyArray<{ readonly icon: IconName; readonly label: string }> = [
  { icon: "aperture", label: "Cull" },
  { icon: "sliders", label: "Colour" },
  { icon: "tag", label: "Rename" },
  { icon: "film", label: "Storyboard" },
];

export const features: ReadonlyArray<Feature> = [
  {
    icon: "grid",
    title: "Cull",
    body: "Rate, label and tag at speed.",
  },
  {
    icon: "sliders",
    title: "Colour",
    body: "Non-destructive adjustments.",
  },
  {
    icon: "tag",
    title: "Rename",
    body: "Review every name first.",
  },
  {
    icon: "layers",
    title: "Convert",
    body: "JPEG, PNG, WebP and TIFF.",
  },
  {
    icon: "film",
    title: "Storyboard",
    body: "Turn a clip into frames.",
  },
  {
    icon: "printer",
    title: "Print",
    body: "Contact sheets when you need them.",
  },
];

export const showcase = [
  {
    tone: "green",
    icon: "star",
    eyebrow: "Cull",
    title: "Keep the good ones.",
    body: "Rate, label and tag.",
  },
  {
    tone: "orange",
    icon: "sliders",
    eyebrow: "Colour",
    title: "Make it feel right.",
    body: "Tone, colour and effects.",
  },
  {
    tone: "blue",
    icon: "tag",
    eyebrow: "Rename",
    title: "Names that stay in order.",
    body: "Batch rename, no overwrites.",
  },
  {
    tone: "pink",
    icon: "printer",
    eyebrow: "Print",
    title: "A proof when you need it.",
    body: "Contact sheets, on demand.",
  },
] as const satisfies ReadonlyArray<ShowcaseCard>;

export const useCases: ReadonlyArray<UseCase> = [
  { title: "Portfolio", body: "Shape a long edit." },
  { title: "Client proof", body: "Send a folder." },
  { title: "Archive", body: "Make it findable." },
  { title: "Zine", body: "Check the sequence." },
  { title: "Exhibition", body: "Test the wall." },
  { title: "Storyboard", body: "Turn clips into frames." },
  { title: "Campaign", body: "Keep the finals close." },
  { title: "Print", body: "Make a sheet." },
];

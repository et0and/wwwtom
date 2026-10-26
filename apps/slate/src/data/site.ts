export type IconName =
  | "archive"
  | "arrow-left"
  | "arrow-right"
  | "arrow-up-right"
  | "aperture"
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
  { icon: "aperture", label: "For the first pass" },
  { icon: "sliders", label: "For the edit" },
  { icon: "archive", label: "For the archive" },
  { icon: "sheet", label: "For the print" },
];

export const features: ReadonlyArray<Feature> = [
  {
    icon: "grid",
    title: "Built for the cull",
    body: "Rate, label and tag across a virtualised grid that only decodes what is on screen.",
  },
  {
    icon: "folder",
    title: "Local by default",
    body: "Your photos stay in their folders. collection.slate keeps the edit portable.",
  },
  {
    icon: "sheet",
    title: "A real contact sheet",
    body: "A4, A3, Letter, Tabloid or custom. Live preview, saved layouts and a streaming PDF.",
  },
  {
    icon: "sliders",
    title: "Colour without copies",
    body: "Non-destructive tone and colour adjustments. The original file is never written.",
  },
  {
    icon: "film",
    title: "Video storyboards",
    body: "Split a clip into equal frames and land them beside the source, ready for a sheet.",
  },
  {
    icon: "drive",
    title: "Drive when you need it",
    body: "Browse, import and export from Google Drive without turning your archive into a cloud library.",
  },
];

export const showcase = [
  {
    tone: "green",
    icon: "star",
    eyebrow: "The first pass",
    title: "Keep the frames worth keeping.",
    body: "Stars, colour labels, tags and a contact sheet that updates as you work.",
  },
  {
    tone: "orange",
    icon: "sliders",
    eyebrow: "The edit",
    title: "Make the frame feel right.",
    body: "Tone, colour and effects that stay in collection.slate and bake only into exports.",
  },
  {
    tone: "blue",
    icon: "printer",
    eyebrow: "The sheet",
    title: "A proof you can hand over.",
    body: "A live layout, a saved sheet and a flat RGB PDF at up to 300 DPI per cell.",
  },
  {
    tone: "pink",
    icon: "film",
    eyebrow: "Motion",
    title: "Turn a clip into a sequence.",
    body: "Import a video, choose the number of frames, and get a storyboard collection beside the clip.",
  },
] as const satisfies ReadonlyArray<ShowcaseCard>;

export const useCases: ReadonlyArray<UseCase> = [
  {
    title: "Edit a portfolio",
    body: "Bring a long edit down to the frames that belong together.",
  },
  {
    title: "Proof a client shoot",
    body: "Share a contact sheet the client can read without an account.",
  },
  {
    title: "Index an archive",
    body: "Give decades of folders ratings, labels and a way back in.",
  },
  {
    title: "Make a zine",
    body: "Lay out a sequence, check the rhythm and export a print-ready sheet.",
  },
  {
    title: "Plan an exhibition",
    body: "Test wall order and image pairings before anything is framed.",
  },
  {
    title: "Storyboard a film",
    body: "Pull equal frames from a clip and build a visual beat sheet.",
  },
  {
    title: "Cull a festival",
    body: "Move fast through thousands of frames without losing the selects.",
  },
  {
    title: "Deliver a campaign",
    body: "Keep variants, notes and final layouts together in one folder.",
  },
  {
    title: "Organise a residency",
    body: "Make a quiet visual record of the work as it develops.",
  },
  {
    title: "Print a family archive",
    body: "Turn a folder of scans into a sheet you can hold and share.",
  },
  {
    title: "Review a collection",
    body: "Revisit old work by date, type, rating or the tags you left yourself.",
  },
  {
    title: "Keep a visual diary",
    body: "A folder, a sheet and a small file that stays yours.",
  },
];

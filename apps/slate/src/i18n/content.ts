import type { IconName } from "../data/site";

export const locales = ["en", "ja"] as const;
export type Locale = (typeof locales)[number];

export const defaultLocale: Locale = "en";

export const localeNames = {
  en: "English",
  ja: "日本語",
} as const satisfies Record<Locale, string>;

export const localePaths = {
  en: "/",
  ja: "/ja",
} as const satisfies Record<Locale, string>;

export function otherLocale(locale: Locale): Locale {
  return locale === "en" ? "ja" : "en";
}

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

export interface ThemePreview {
  readonly name: string;
  readonly src: string;
  readonly alt: string;
  readonly background: string;
}

export interface SiteCopy {
  readonly meta: {
    readonly title: string;
    readonly description: string;
    readonly ogLocale: string;
    readonly ogImageAlt: string;
  };
  readonly nav: {
    readonly brandAria: string;
    readonly label: string;
    readonly workstation: string;
    readonly themes: string;
    readonly releases: string;
    readonly download: string;
    readonly switchAria: string;
  };
  readonly hero: {
    readonly titleLines: ReadonlyArray<string>;
    readonly lede: string;
    readonly download: string;
    readonly free: string;
    readonly platforms: string;
    readonly watch: string;
    readonly imageAlt: string;
  };
  readonly features: ReadonlyArray<Feature>;
  readonly themes: {
    readonly eyebrow: string;
    readonly title: string;
    readonly previous: string;
    readonly next: string;
    readonly dotLabel: (name: string) => string;
    readonly items: ReadonlyArray<ThemePreview>;
  };
  readonly showcase: {
    readonly eyebrow: string;
    readonly title: string;
    readonly previous: string;
    readonly next: string;
    readonly sliders: {
      readonly exposure: string;
      readonly contrast: string;
      readonly warmth: string;
      readonly curve: string;
    };
    readonly items: readonly [ShowcaseCard, ShowcaseCard, ShowcaseCard, ShowcaseCard];
  };
  readonly useCases: {
    readonly title: string;
    readonly lede: string;
    readonly items: ReadonlyArray<UseCase>;
  };
  readonly footer: {
    readonly brandAria: string;
    readonly tagline: string;
    readonly slateLabel: string;
    readonly readLabel: string;
    readonly website: string;
    readonly github: string;
    readonly releases: string;
    readonly documentation: string;
    readonly drive: string;
    readonly license: string;
  };
}

const en: SiteCopy = {
  meta: {
    title: "Slate — A photo manager, shaped for you",
    description:
      "A local-first photography workstation for culling, colour, renaming, conversion, storyboards and delivery.",
    ogLocale: "en_US",
    ogImageAlt: "Slate photo workstation",
  },
  nav: {
    brandAria: "Slate home",
    label: "Primary",
    workstation: "Workstation",
    themes: "Themes",
    releases: "Releases",
    download: "Download",
    switchAria: "日本語で表示",
  },
  hero: {
    titleLines: ["A photo manager, shaped for you."],
    lede: "Cull, colour, rename, convert, storyboard and deliver in one local-first app.",
    download: "Download Slate",
    free: "Free and open source",
    platforms: "macOS · Windows · Linux",
    watch: "See the workstation",
    imageAlt: "Slate photo workstation with the library and photo inspector",
  },
  features: [
    { icon: "grid", title: "Cull", body: "Rate, label and tag at speed." },
    { icon: "sliders", title: "Colour", body: "Non-destructive adjustments." },
    { icon: "tag", title: "Rename", body: "Review every name first." },
    { icon: "layers", title: "Convert", body: "JPEG, PNG, WebP and TIFF." },
    { icon: "film", title: "Storyboard", body: "Turn a clip into frames." },
    { icon: "printer", title: "Print", body: "Contact sheets when you need them." },
  ],
  themes: {
    eyebrow: "Themes",
    title: "A workspace that fits the room.",
    previous: "Previous theme",
    next: "Next theme",
    dotLabel: (name) => `Show the ${name} theme`,
    items: [
      {
        name: "Nord",
        src: "/screens/themes/nord.png",
        alt: "Slate in the Nord theme",
        background: "#2e3440",
      },
      {
        name: "Dark",
        src: "/screens/themes/dark.png",
        alt: "Slate in the Dark theme",
        background: "#0b0b0c",
      },
      {
        name: "Monokai",
        src: "/screens/themes/monokai.png",
        alt: "Slate in the Monokai theme",
        background: "#1f1f1c",
      },
      {
        name: "Light",
        src: "/screens/themes/light.png",
        alt: "Slate in the Light theme",
        background: "#f6f6f4",
      },
    ],
  },
  showcase: {
    eyebrow: "A DAW for photographs",
    title: "The whole edit, in one window.",
    previous: "Previous cards",
    next: "Next cards",
    sliders: {
      exposure: "Exposure",
      contrast: "Contrast",
      warmth: "Warmth",
      curve: "Curve",
    },
    items: [
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
    ],
  },
  useCases: {
    title: "What will you make?",
    lede: "A folder, a shoot, an archive. Start there.",
    items: [
      { title: "Portfolio", body: "Shape a long edit." },
      { title: "Client proof", body: "Send a folder." },
      { title: "Archive", body: "Make it findable." },
      { title: "Zine", body: "Check the sequence." },
      { title: "Exhibition", body: "Test the wall." },
      { title: "Storyboard", body: "Turn clips into frames." },
      { title: "Campaign", body: "Keep the finals close." },
      { title: "Print", body: "Make a sheet." },
    ],
  },
  footer: {
    brandAria: "Slate home",
    tagline: "A photo manager, shaped for you.",
    slateLabel: "Slate",
    readLabel: "Read",
    website: "Website",
    github: "GitHub",
    releases: "Releases",
    documentation: "Documentation",
    drive: "Google Drive setup",
    license: "License",
  },
};

const ja: SiteCopy = {
  meta: {
    title: "Slate — あなたに合わせるフォトマネージャー",
    description:
      "選別、色調整、名前変更、変換、絵コンテ、書き出しのためのローカル優先の写真ワークステーション。",
    ogLocale: "ja_JP",
    ogImageAlt: "Slateの写真ワークステーション",
  },
  nav: {
    brandAria: "Slate ホーム",
    label: "メインナビゲーション",
    workstation: "ワークステーション",
    themes: "テーマ",
    releases: "リリース",
    download: "ダウンロード",
    switchAria: "英語で表示",
  },
  hero: {
    titleLines: ["あなたに合わせる", "フォトマネージャー。"],
    lede: "選別から色調整、名前変更、変換、絵コンテ、書き出しまで。ローカル優先のひとつのアプリで。",
    download: "Slateをダウンロード",
    free: "無料・オープンソース",
    platforms: "macOS · Windows · Linux",
    watch: "ワークステーションを見る",
    imageAlt: "ライブラリと写真インスペクターを表示したSlateの写真ワークステーション",
  },
  features: [
    { icon: "grid", title: "選別", body: "評価、ラベル、タグをすばやく。" },
    { icon: "sliders", title: "色調整", body: "非破壊の調整。" },
    { icon: "tag", title: "名前変更", body: "適用前にすべて確認。" },
    { icon: "layers", title: "変換", body: "JPEG、PNG、WebP、TIFF。" },
    { icon: "film", title: "絵コンテ", body: "動画からフレームを作成。" },
    { icon: "printer", title: "プリント", body: "必要なときにコンタクトシート。" },
  ],
  themes: {
    eyebrow: "テーマ",
    title: "空間に合うワークスペース。",
    previous: "前のテーマ",
    next: "次のテーマ",
    dotLabel: (name) => `${name}テーマを表示`,
    items: [
      {
        name: "Nord",
        src: "/screens/themes/nord.png",
        alt: "NordテーマのSlate",
        background: "#2e3440",
      },
      {
        name: "Dark",
        src: "/screens/themes/dark.png",
        alt: "DarkテーマのSlate",
        background: "#0b0b0c",
      },
      {
        name: "Monokai",
        src: "/screens/themes/monokai.png",
        alt: "MonokaiテーマのSlate",
        background: "#1f1f1c",
      },
      {
        name: "Light",
        src: "/screens/themes/light.png",
        alt: "LightテーマのSlate",
        background: "#f6f6f4",
      },
    ],
  },
  showcase: {
    eyebrow: "写真のためのDAW",
    title: "編集のすべてを、ひとつのウィンドウで。",
    previous: "前のカード",
    next: "次のカード",
    sliders: {
      exposure: "露出",
      contrast: "コントラスト",
      warmth: "暖色",
      curve: "カーブ",
    },
    items: [
      {
        tone: "green",
        icon: "star",
        eyebrow: "選別",
        title: "残す一枚を選ぶ。",
        body: "評価、ラベル、タグ。",
      },
      {
        tone: "orange",
        icon: "sliders",
        eyebrow: "色調整",
        title: "色を、思い通りに。",
        body: "トーン、色、エフェクト。",
      },
      {
        tone: "blue",
        icon: "tag",
        eyebrow: "名前変更",
        title: "整理された名前。",
        body: "一括変更。上書きなし。",
      },
      {
        tone: "pink",
        icon: "printer",
        eyebrow: "プリント",
        title: "必要なときに、証明に。",
        body: "コンタクトシートを必要なときに。",
      },
    ],
  },
  useCases: {
    title: "何をつくりますか？",
    lede: "フォルダ、撮影、アーカイブ。そこから始めよう。",
    items: [
      { title: "ポートフォリオ", body: "長い編集を整える。" },
      { title: "クライアント確認", body: "フォルダを送る。" },
      { title: "アーカイブ", body: "見つけられるように。" },
      { title: "ZINE", body: "並びを確認する。" },
      { title: "展示", body: "壁での見え方を試す。" },
      { title: "絵コンテ", body: "動画をフレームに。" },
      { title: "キャンペーン", body: "最終版を手元に。" },
      { title: "プリント", body: "シートをつくる。" },
    ],
  },
  footer: {
    brandAria: "Slate ホーム",
    tagline: "あなたに合わせるフォトマネージャー。",
    slateLabel: "Slate",
    readLabel: "リソース",
    website: "ウェブサイト",
    github: "GitHub",
    releases: "リリース",
    documentation: "ドキュメント",
    drive: "Google Drive の設定",
    license: "ライセンス",
  },
};

export const content = { en, ja } satisfies Record<Locale, SiteCopy>;

export function getContent(locale: Locale): SiteCopy {
  return content[locale];
}

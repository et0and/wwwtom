import type { IconName } from "../data/site";

export const locales = ["en", "ja"] as const;
export type Locale = (typeof locales)[number];

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
    readonly videoClose: string;
    readonly imageAlt: string;
  };
  readonly features: {
    readonly title: string;
    readonly items: ReadonlyArray<Feature>;
  };
  readonly noLimits: {
    readonly title: string;
    readonly body: string;
  };
  readonly themes: {
    readonly eyebrow: string;
    readonly title: string;
    readonly previous: string;
    readonly next: string;
    readonly dotLabel: (name: string) => string;
    readonly items: ReadonlyArray<ThemePreview>;
  };
  readonly footer: {
    readonly brandAria: string;
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
    title: "Slate — A DAM for photographers",
    description: "A local-first DAM to preview, organise, edit and publish your whole library.",
    ogLocale: "en_US",
    ogImageAlt: "Slate photo DAM",
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
    titleLines: ["A DAM for photographers."],
    lede: "The whole library, in one local-first app.",
    download: "Download Slate",
    free: "Free and open source",
    platforms: "macOS · Windows · Linux",
    watch: "See it in action",
    videoClose: "Close video",
    imageAlt: "Slate photo DAM with the library and photo inspector",
  },
  features: {
    title: "What you can do.",
    items: [
      {
        icon: "aperture",
        title: "Preview",
        body: "Thumbnails and rich previews for raw, PSD, PDF, video and 3D files.",
      },
      {
        icon: "tag",
        title: "Organise",
        body: "Ratings, labels, keywords and metadata, with multiple folders open at once.",
      },
      {
        icon: "grid",
        title: "Find",
        body: "Collections, advanced filters and metadata search.",
      },
      {
        icon: "sliders",
        title: "Edit",
        body: "Non-destructive tone and colour, raw files, external editors and custom shortcuts.",
      },
      {
        icon: "layers",
        title: "Batch",
        body: "Rename, convert, resize and export folders, or chain tasks into one workflow.",
      },
      {
        icon: "printer",
        title: "Publish",
        body: "Contact sheets, portfolio sites, shared libraries and stock.",
      },
    ],
  },
  noLimits: {
    title: "No subscription.",
    body: "RAW editing is included.",
  },
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
  footer: {
    brandAria: "Slate home",
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
    title: "Slate — 写真のためのDAM",
    description: "写真をプレビュー、整理、編集、公開できるローカル優先のDAM。",
    ogLocale: "ja_JP",
    ogImageAlt: "Slateの写真DAM",
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
    titleLines: ["写真のための", "DAM。"],
    lede: "ライブラリ全体を、ひとつのローカル優先アプリで。",
    download: "Slateをダウンロード",
    free: "無料・オープンソース",
    platforms: "macOS · Windows · Linux",
    watch: "実際の動作を見る",
    videoClose: "動画を閉じる",
    imageAlt: "ライブラリと写真インスペクターを表示したSlateの写真DAM",
  },
  features: {
    title: "Slateでできること。",
    items: [
      {
        icon: "aperture",
        title: "プレビュー",
        body: "RAW、PSD、PDF、動画、3Dファイルをサムネイルとリッチプレビューで確認。",
      },
      {
        icon: "tag",
        title: "整理",
        body: "評価、ラベル、キーワード、メタデータをライブラリ全体に。複数のフォルダも同時に開けます。",
      },
      {
        icon: "grid",
        title: "検索",
        body: "コレクション、詳細フィルター、メタデータ検索。",
      },
      {
        icon: "sliders",
        title: "編集",
        body: "トーンと色を非破壊で調整。RAW、外部エディター、カスタムショートカットに対応。",
      },
      {
        icon: "layers",
        title: "一括処理",
        body: "名前変更、変換、サイズ変更、書き出し。タスクをつないでワークフローに。",
      },
      {
        icon: "printer",
        title: "公開",
        body: "コンタクトシート、ポートフォリオサイト、共有ライブラリ、ストックへ。",
      },
    ],
  },
  noLimits: {
    title: "サブスクリプション不要。",
    body: "RAW編集も利用できます。",
  },
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
  footer: {
    brandAria: "Slate ホーム",
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

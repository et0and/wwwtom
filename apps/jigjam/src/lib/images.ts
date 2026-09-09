export type PresetImage = {
  readonly id: string;
  readonly label: string;
  readonly src: string;
};

export const PRESET_IMAGES: ReadonlyArray<PresetImage> = [
  { id: "mist-hills", label: "Mist hills", src: "presets/mist-hills.svg" },
  { id: "calm-sea", label: "Calm sea", src: "presets/calm-sea.svg" },
  { id: "soft-bloom", label: "Soft bloom", src: "presets/soft-bloom.svg" },
];

export const presetById = (id: string): PresetImage | undefined =>
  PRESET_IMAGES.find((preset) => preset.id === id);

export const MAX_BOARD_WIDTH = 800;
export const MAX_BOARD_HEIGHT = 560;

export type BoardSize = {
  readonly w: number;
  readonly h: number;
};

export const fitBoard = (naturalWidth: number, naturalHeight: number): BoardSize => {
  const safeWidth = naturalWidth > 0 ? naturalWidth : 800;
  const safeHeight = naturalHeight > 0 ? naturalHeight : 600;
  const scale = Math.min(MAX_BOARD_WIDTH / safeWidth, MAX_BOARD_HEIGHT / safeHeight, 1);
  return {
    w: Math.max(240, Math.round(safeWidth * scale)),
    h: Math.max(180, Math.round(safeHeight * scale)),
  };
};

export const readFileAsDataUrl = (file: File): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result;
      if (result === null || result instanceof ArrayBuffer) {
        reject(new Error("Read failed"));
        return;
      }
      resolve(result);
    };
    reader.onerror = () => reject(reader.error ?? new Error("Read failed"));
    reader.readAsDataURL(file);
  });

export const loadImageSize = (src: string): Promise<{ w: number; h: number }> =>
  new Promise((resolve) => {
    const image = new Image();
    image.onload = () => resolve({ w: image.naturalWidth || 800, h: image.naturalHeight || 600 });
    image.onerror = () => resolve({ w: 800, h: 600 });
    image.src = src;
  });

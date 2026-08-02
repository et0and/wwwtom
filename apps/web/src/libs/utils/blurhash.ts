import { Effect } from "effect";
import { decode } from "blurhash";

export function decodeBlurhash(
  hash: string | null | undefined,
  width: number = 32,
  height: number = 32,
) {
  return Effect.try({
    try: () => {
      if (!hash) return null;

      const pixels = decode(hash, width, height);
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;

      const ctx = canvas.getContext("2d");
      if (!ctx) return null;

      const imageData = ctx.createImageData(width, height);
      imageData.data.set(pixels);
      ctx.putImageData(imageData, 0, 0);

      return canvas.toDataURL();
    },
    catch: () => null,
  }).pipe(Effect.catch(() => Effect.succeed(null)));
}

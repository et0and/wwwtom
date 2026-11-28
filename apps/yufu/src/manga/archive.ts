import { unzipSync } from "fflate";
import { createExtractorFromData } from "node-unrar-js";
import unrarWasmUrl from "node-unrar-js/esm/js/unrar.wasm?url";

const isImage = (name: string): boolean => /\.(png|jpe?g|webp|gif)$/i.test(name);

const fromCbz = (data: ArrayBuffer): ReadonlyArray<Uint8Array> => {
  const entries = Object.entries(unzipSync(new Uint8Array(data)));
  return entries
    .filter(([name]) => isImage(name))
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([, bytes]) => bytes);
};

const fromCbr = async (data: ArrayBuffer): Promise<ReadonlyArray<Uint8Array>> => {
  const wasm = await fetch(unrarWasmUrl).then((response) => response.arrayBuffer());
  const extractor = await createExtractorFromData({ data, wasmBinary: wasm });
  const names = Array.from(extractor.getFileList().fileHeaders)
    .filter((header) => !header.flags.directory && isImage(header.name))
    .map((header) => header.name);
  const extracted = extractor.extract({ files: names });
  return Array.from(extracted.files)
    .map((file) => file.extraction)
    .filter((bytes): bytes is Uint8Array => bytes !== undefined);
};

/** CBZ is a ZIP of images; CBR is decoded with the bundled unrar WASM. */
export const decodeArchive = async (
  data: ArrayBuffer,
  name: string,
): Promise<ReadonlyArray<Uint8Array>> => (/\.cbr$/i.test(name) ? fromCbr(data) : fromCbz(data));

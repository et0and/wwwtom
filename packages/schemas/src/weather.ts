import { Schema, SchemaGetter } from "effect";

/**
 * The panel font has printable ASCII only. wttr.in returns UTF-8 with a degree
 * sign, so the wire contract is the normalised ASCII form, not the raw text.
 */
export const WeatherTextSchema = Schema.String.pipe(
  Schema.decodeTo(Schema.String, {
    decode: SchemaGetter.transform((value: string) =>
      value
        .replace(/\s*°\s*([CF])/g, "$1")
        .replace(/[^\x20-\x7E]/g, "")
        .replace(/\s+/g, " ")
        .trim(),
    ),
    encode: SchemaGetter.transform((value: string) => value),
  }),
);

/** One `wttr.in?format=%C|%t` reading, split and normalised for the panel. */
export const WeatherReadingSchema = Schema.Struct({
  condition: WeatherTextSchema,
  temperature: WeatherTextSchema,
}).pipe(
  Schema.check(
    Schema.makeFilter((reading) =>
      reading.condition !== "" || reading.temperature !== "" ? true : "weather reading is empty",
    ),
  ),
);
export type WeatherReading = typeof WeatherReadingSchema.Type;

/**
 * Current conditions from wttr.in, reduced to ASCII because the frame's small
 * panel font has no glyphs beyond printable ASCII. `observedAt` is when the
 * adapter fetched it, not the upstream's own timestamp.
 */
export const WeatherSchema = Schema.Struct({
  location: Schema.String,
  condition: WeatherTextSchema,
  temperature: WeatherTextSchema,
  observedAt: Schema.String,
});
export type Weather = typeof WeatherSchema.Type;

import { Schema } from "effect";

/**
 * Current conditions from wttr.in, reduced to ASCII because the frame's small
 * panel font has no glyphs beyond printable ASCII. `observedAt` is when the
 * adapter fetched it, not the upstream's own timestamp.
 */
export const WeatherSchema = Schema.Struct({
  location: Schema.String,
  condition: Schema.String,
  temperature: Schema.String,
  observedAt: Schema.String,
});
export type Weather = typeof WeatherSchema.Type;

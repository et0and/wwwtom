import { Elysia } from "elysia";
import { Effect, Schema } from "effect";
import type { Weather } from "@tom/schemas/weather";
import { HttpStatus } from "@tom/constants/http";
import { HttpError } from "@tom/types/errors";
import { logContextFromRequest } from "@tom/utils/worker";
import { AdapterError, runAdapter } from "../runtime";

const WEATHER_CACHE_CONTROL = "public, max-age=900, s-maxage=1800";
const WEATHER_ENDPOINT = "https://wttr.in";
const WEATHER_TIMEOUT_MS = 8000;

const isLocation = Schema.makeFilter((value: string) =>
  /^[A-Za-z][A-Za-z .,'-]{0,60}$/.test(value) ? true : "must be a place name",
);

const LocationParamsSchema = Schema.toStandardSchemaV1(
  Schema.Struct({
    location: Schema.String.pipe(Schema.check(isLocation)),
  }),
);

/** The panel font is printable ASCII only: drop the degree sign, keep the C. */
const toAscii = (value: string): string =>
  value
    .replace(/°\s*([CF])/g, "$1")
    .replace(/[^\x20-\x7E]/g, "")
    .replace(/\s+/g, " ")
    .trim();

const fetchWeather = (location: string): Effect.Effect<Weather, HttpError> =>
  Effect.gen(function* () {
    const url = `${WEATHER_ENDPOINT}/${encodeURIComponent(location)}?format=%C|%t`;
    const response = yield* Effect.tryPromise({
      try: () =>
        fetch(url, {
          headers: { Accept: "text/plain" },
          signal: AbortSignal.timeout(WEATHER_TIMEOUT_MS),
        }),
      catch: (cause) =>
        new HttpError({
          message: "Failed to fetch weather",
          status: HttpStatus.BadGateway,
          cause,
        }),
    });
    if (!response.ok) {
      return yield* new HttpError({
        message: `Weather upstream failed: ${response.status}`,
        status: HttpStatus.BadGateway,
      });
    }
    const body = yield* Effect.tryPromise({
      try: () => response.text(),
      catch: (cause) =>
        new HttpError({
          message: "Failed to read weather response",
          status: HttpStatus.BadGateway,
          cause,
        }),
    });

    const [rawCondition, rawTemperature] = body.split("|");
    const condition = toAscii(rawCondition ?? "").slice(0, 60);
    const temperature = toAscii(rawTemperature ?? "").slice(0, 12);
    if (condition === "" && temperature === "") {
      return yield* new HttpError({
        message: "Weather upstream returned no data",
        status: HttpStatus.BadGateway,
      });
    }

    return {
      location,
      condition,
      temperature,
      observedAt: new Date().toISOString(),
    } satisfies Weather;
  });

export const getWeatherRoute = new Elysia().get(
  "/weather/:location",
  async ({ params, request, set }) => {
    // Only set cache headers on the success path; a failed read must not be
    // stored at the edge.
    const weather = await runAdapter(
      fetchWeather(params.location),
      (error) => new AdapterError({ status: error.status, message: error.message }),
      logContextFromRequest(request, "tom-adapter"),
    );
    set.headers["Cache-Control"] = WEATHER_CACHE_CONTROL;
    set.headers["CDN-Cache-Control"] = WEATHER_CACHE_CONTROL;
    return weather;
  },
  {
    params: LocationParamsSchema,
    detail: {
      description: "Current conditions from wttr.in for the frame overlay",
      tags: ["weather"],
    },
  },
);

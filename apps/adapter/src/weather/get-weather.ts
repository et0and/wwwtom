import { Elysia } from "elysia";
import { Effect, Schema } from "effect";
import { WeatherReadingSchema, type Weather } from "@tom/schemas/weather";
import { HttpStatus } from "@tom/constants/http";
import { HttpError } from "@tom/types/errors";
import { logContextFromRequest } from "@tom/utils/worker";
import { AdapterError, runAdapter } from "../runtime";

const WEATHER_CACHE_CONTROL = "public, max-age=900, s-maxage=1800";
const WTTR_ENDPOINT = "https://wttr.in";
const OPEN_METEO_GEOCODING_ENDPOINT = "https://geocoding-api.open-meteo.com/v1/search";
const OPEN_METEO_FORECAST_ENDPOINT = "https://api.open-meteo.com/v1/forecast";
const WEATHER_TIMEOUT_MS = 8000;

const isLocation = Schema.makeFilter((value: string) =>
  /^[A-Za-z][A-Za-z .,'-]{0,60}$/.test(value) ? true : "must be a place name",
);

const LocationParamsSchema = Schema.toStandardSchemaV1(
  Schema.Struct({
    location: Schema.String.pipe(Schema.check(isLocation)),
  }),
);

const GeocodingSchema = Schema.Struct({
  results: Schema.optional(
    Schema.Array(
      Schema.Struct({
        latitude: Schema.Finite,
        longitude: Schema.Finite,
      }),
    ),
  ),
});

const OpenMeteoForecastSchema = Schema.Struct({
  current: Schema.Struct({
    temperature_2m: Schema.Finite,
    weather_code: Schema.Int,
  }),
});

const fetchJson = <A, I>(
  url: string,
  schema: Schema.Codec<A, I>,
  label: string,
): Effect.Effect<A, HttpError> =>
  Effect.gen(function* () {
    const response = yield* Effect.tryPromise({
      try: () =>
        fetch(url, {
          headers: { Accept: "application/json" },
          signal: AbortSignal.timeout(WEATHER_TIMEOUT_MS),
        }),
      catch: (cause) =>
        new HttpError({
          message: `Failed to fetch ${label}`,
          status: HttpStatus.BadGateway,
          cause,
        }),
    });
    if (!response.ok) {
      return yield* new HttpError({
        message: `${label} upstream failed: ${response.status}`,
        status: HttpStatus.BadGateway,
      });
    }
    const json = yield* Effect.tryPromise({
      try: () => response.json(),
      catch: (cause) =>
        new HttpError({
          message: `Failed to read ${label} response`,
          status: HttpStatus.BadGateway,
          cause,
        }),
    });
    return yield* Schema.decodeUnknownEffect(schema)(json).pipe(
      Effect.mapError(
        (cause) =>
          new HttpError({
            message: `${label} returned an invalid response`,
            status: HttpStatus.BadGateway,
            cause,
          }),
      ),
    );
  });

const fetchWttrWeather = (location: string): Effect.Effect<Weather, HttpError> =>
  Effect.gen(function* () {
    // `m` forces metric units; wttr.in otherwise picks units from the caller's
    // egress location, which is a US Cloudflare colo in production.
    const url = `${WTTR_ENDPOINT}/${encodeURIComponent(location)}?format=%C|%t&m`;
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

    const [rawCondition = "", rawTemperature = ""] = body.split("|");
    const reading = yield* Schema.decodeUnknownEffect(WeatherReadingSchema)({
      condition: rawCondition,
      temperature: rawTemperature,
    }).pipe(
      Effect.mapError(
        (cause) =>
          new HttpError({
            message: "Weather upstream returned no data",
            status: HttpStatus.BadGateway,
            cause,
          }),
      ),
    );

    return {
      location,
      condition: reading.condition,
      temperature: reading.temperature,
      observedAt: new Date().toISOString(),
    } satisfies Weather;
  });

const geocodeLocation = (
  location: string,
): Effect.Effect<{ latitude: number; longitude: number }, HttpError> =>
  Effect.gen(function* () {
    const url =
      `${OPEN_METEO_GEOCODING_ENDPOINT}?name=${encodeURIComponent(location)}` +
      "&count=1&language=en&format=json";
    const result = yield* fetchJson(url, GeocodingSchema, "Open-Meteo geocoding");
    const first = result.results?.[0];
    if (first === undefined) {
      return yield* new HttpError({
        message: `Weather location not found: ${location}`,
        status: HttpStatus.BadGateway,
      });
    }
    return first;
  });

/** WMO weather code to a short ASCII label for the panel. */
const WEATHER_CONDITIONS = new Map<number, string>([
  [0, "Clear"],
  [1, "Mainly clear"],
  [2, "Partly cloudy"],
  [3, "Overcast"],
  [45, "Fog"],
  [48, "Freezing fog"],
  [51, "Drizzle"],
  [53, "Drizzle"],
  [55, "Drizzle"],
  [56, "Freezing drizzle"],
  [57, "Freezing drizzle"],
  [61, "Rain"],
  [63, "Rain"],
  [65, "Rain"],
  [66, "Freezing rain"],
  [67, "Freezing rain"],
  [71, "Snow"],
  [73, "Snow"],
  [75, "Snow"],
  [77, "Snow grains"],
  [80, "Rain showers"],
  [81, "Rain showers"],
  [82, "Rain showers"],
  [85, "Snow showers"],
  [86, "Snow showers"],
  [95, "Thunderstorm"],
  [96, "Thunderstorm"],
  [99, "Thunderstorm"],
]);

const conditionForCode = (code: number): string => WEATHER_CONDITIONS.get(code) ?? "Unknown";

const temperatureFor = (celsius: number): string => {
  const rounded = Math.round(celsius);
  return rounded > 0 ? `+${rounded}C` : `${rounded}C`;
};

const fetchOpenMeteoWeather = (location: string): Effect.Effect<Weather, HttpError> =>
  Effect.gen(function* () {
    const coordinates = yield* geocodeLocation(location);
    const url =
      `${OPEN_METEO_FORECAST_ENDPOINT}?latitude=${coordinates.latitude}` +
      `&longitude=${coordinates.longitude}&current=temperature_2m,weather_code` +
      "&timezone=auto";
    const forecast = yield* fetchJson(url, OpenMeteoForecastSchema, "Open-Meteo");
    const reading = yield* Schema.decodeUnknownEffect(WeatherReadingSchema)({
      condition: conditionForCode(forecast.current.weather_code),
      temperature: temperatureFor(forecast.current.temperature_2m),
    }).pipe(
      Effect.mapError(
        (cause) =>
          new HttpError({
            message: "Open-Meteo returned no usable reading",
            status: HttpStatus.BadGateway,
            cause,
          }),
      ),
    );

    return {
      location,
      condition: reading.condition,
      temperature: reading.temperature,
      observedAt: new Date().toISOString(),
    } satisfies Weather;
  });

const fetchWeather = (location: string): Effect.Effect<Weather, HttpError> =>
  fetchWttrWeather(location).pipe(
    Effect.catch((error) =>
      Effect.gen(function* () {
        yield* Effect.logWarning("wttr.in unavailable; falling back to Open-Meteo", {
          message: error.message,
        });
        return yield* fetchOpenMeteoWeather(location);
      }),
    ),
  );

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
      description: "Current conditions from wttr.in, with Open-Meteo as fallback",
      tags: ["weather"],
    },
  },
);

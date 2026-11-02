import { Elysia } from "elysia";
import { getWeatherRoute } from "./get-weather";

export const weatherIntegration = new Elysia({ name: "weather" }).use(getWeatherRoute);

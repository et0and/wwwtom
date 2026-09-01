import { Schedule } from "effect";

export const retryPolicy = Schedule.max([Schedule.exponential(200), Schedule.recurs(3)]);

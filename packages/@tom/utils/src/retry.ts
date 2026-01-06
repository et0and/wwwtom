import { Schedule } from "effect";

export const retryPolicy = Schedule.exponential(200).pipe(Schedule.compose(Schedule.recurs(3)));

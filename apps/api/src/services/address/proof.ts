import { Effect } from "effect";
import { HttpError } from "@tom/types/errors";
import { sha256Hex } from "./auth";

export const proofError = (message: string): HttpError => new HttpError({ message, status: 428 });

export const generateChallengeData = (
  difficulty = 4,
): {
  readonly challengeId: string;
  readonly token: string;
  readonly difficulty: number;
  readonly expiresAt: number;
} => {
  const token = crypto.randomUUID();
  const challengeId = crypto.randomUUID();
  const expiresAt = Date.now() + 3600000;

  return {
    challengeId,
    token,
    difficulty,
    expiresAt,
  };
};

export const validateProof = (
  nonce: number,
  token: string,
  difficulty: number,
): Effect.Effect<void, HttpError> =>
  Effect.gen(function* () {
    const hash = yield* Effect.tryPromise({
      try: () => sha256Hex(token + nonce.toString()),
      catch: () => proofError("Invalid proof"),
    });

    const prefix = "0".repeat(difficulty);
    if (!hash.startsWith(prefix)) {
      return yield* proofError("Invalid proof");
    }
  });

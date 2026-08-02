import type { EmailAdapter, SendEmailOptions } from "payload";
import { Effect } from "effect";

const DEFAULT_FROM_ADDRESS = "noreply@office.yufugumi.com";
const DEFAULT_FROM_NAME = "Grandma Hope";
const DAILY_SEND_LIMIT = 50;

type CloudflareEmailAdapterArgs = {
  d1: D1Database;
  email: SendEmail;
};

type DailyQuotaRow = {
  send_count: number;
};

type DailyQuotaReservation = {
  dateKey: string;
  sendCount: number;
};

type PayloadAddressValue = {
  address?: string;
  email?: string;
  name?: string;
};

type EmailAddress = {
  address: string;
  name?: string;
};

type AttachmentInput = NonNullable<SendEmailOptions["attachments"]>[number];

const resolveAddress = (value: string | PayloadAddressValue): EmailAddress => {
  if (typeof value === "string") return { address: value };
  const address = value.address ?? value.email;
  if (!address) throw new Error("Email address is missing `address` or `email` value");
  return { address, name: value.name };
};

const resolveAddressList = (
  value: SendEmailOptions["to"] | SendEmailOptions["cc"] | SendEmailOptions["bcc"],
): EmailAddress[] => {
  if (!value) return [];
  if (typeof value === "string") return [{ address: value }];
  if (Array.isArray(value)) return value.map(resolveAddress);
  return [resolveAddress(value)];
};

const formatAddress = (email: EmailAddress): string => {
  if (!email.name) return email.address;
  return `${email.name} <${email.address}>`;
};

const hasRecipientListDelimiter = (value: string): boolean => {
  return value.includes(",") || value.includes(";");
};

const assertNoDisplayName = (addresses: EmailAddress[], field: "to" | "cc" | "bcc"): void => {
  for (const addr of addresses) {
    if (!addr.name) continue;
    throw new Error(`Transactional email does not allow display names in \`${field}\` recipients`);
  }
};

const assertNoRecipientListDelimiter = (
  addresses: EmailAddress[],
  field: "to" | "cc" | "bcc",
): void => {
  for (const addr of addresses) {
    if (!hasRecipientListDelimiter(addr.address)) continue;
    throw new Error(
      `Transactional email does not support delimiter-based recipient lists in \`${field}\``,
    );
  }
};

const resolveSingleAddress = (value: SendEmailOptions["replyTo"]): EmailAddress | undefined => {
  if (!value) return undefined;
  if (typeof value === "string") return { address: value };
  if (Array.isArray(value)) {
    if (value.length === 0) return undefined;
    return resolveAddress(value[0]);
  }
  return resolveAddress(value);
};

const normalizeAttachmentContent = (
  content: AttachmentInput["content"],
): string | ArrayBuffer | ArrayBufferView => {
  return content as string | ArrayBuffer | ArrayBufferView;
};

const normalizeAttachments = (
  attachments: SendEmailOptions["attachments"],
): EmailAttachment[] | undefined => {
  if (!attachments || attachments.length === 0) return undefined;

  return attachments.map((attachment: AttachmentInput) => {
    if (!attachment.filename) {
      throw new Error("Attachment filename is required");
    }

    if (!attachment.content) {
      throw new Error("Attachment content is required");
    }

    const contentType = attachment.contentType ?? "application/octet-stream";
    const content = normalizeAttachmentContent(attachment.content);

    if (attachment.cid) {
      return {
        content,
        contentId: attachment.cid,
        disposition: "inline",
        filename: attachment.filename,
        type: contentType,
      };
    }

    return {
      content,
      disposition: "attachment",
      filename: attachment.filename,
      type: contentType,
    };
  });
};

const getDateKey = (): string => {
  return new Date().toISOString().slice(0, 10);
};

const promiseEffect = <T>(promise: () => Promise<T>): Effect.Effect<T, unknown> => {
  return Effect.tryPromise({
    try: promise,
    catch: (error) => error,
  });
};

const rollbackTransaction = (d1: D1Database): Effect.Effect<void> => {
  return promiseEffect(() => d1.exec("ROLLBACK")).pipe(
    Effect.asVoid,
    Effect.catch(() => Effect.void),
  );
};

const reserveDailySendSlot = (d1: D1Database): Effect.Effect<DailyQuotaReservation, unknown> => {
  const dateKey = getDateKey();

  return promiseEffect(() => d1.exec("BEGIN IMMEDIATE TRANSACTION")).pipe(
    Effect.flatMap(() =>
      Effect.gen(function* () {
        yield* promiseEffect(() =>
          d1
            .prepare(
              "INSERT INTO app_email_daily_quota (date_key, send_count) VALUES (?, 0) ON CONFLICT(date_key) DO NOTHING",
            )
            .bind(dateKey)
            .run(),
        );

        const updateResult = yield* promiseEffect(() =>
          d1
            .prepare(
              "UPDATE app_email_daily_quota SET send_count = send_count + 1, updated_at = CURRENT_TIMESTAMP WHERE date_key = ? AND send_count < ?",
            )
            .bind(dateKey, DAILY_SEND_LIMIT)
            .run(),
        );

        if (updateResult.meta.changes < 1) {
          yield* Effect.fail(
            new Error(`Daily outbound email cap reached (${DAILY_SEND_LIMIT}/day) for ${dateKey}`),
          );
        }

        const row = yield* promiseEffect(() =>
          d1
            .prepare("SELECT send_count FROM app_email_daily_quota WHERE date_key = ? LIMIT 1")
            .bind(dateKey)
            .first<DailyQuotaRow>(),
        );

        if (!row) {
          yield* Effect.fail(new Error("Failed to read updated email quota row"));
        }

        yield* promiseEffect(() => d1.exec("COMMIT"));
        return {
          dateKey,
          sendCount: row.send_count,
        };
      }).pipe(
        Effect.catch((error) =>
          Effect.gen(function* () {
            yield* rollbackTransaction(d1);
            return yield* Effect.fail(error);
          }),
        ),
      ),
    ),
  );
};

const releaseDailySendSlot = (d1: D1Database, dateKey: string): Effect.Effect<void, unknown> => {
  return promiseEffect(() =>
    d1
      .prepare(
        "UPDATE app_email_daily_quota SET send_count = send_count - 1, updated_at = CURRENT_TIMESTAMP WHERE date_key = ? AND send_count > 0",
      )
      .bind(dateKey)
      .run(),
  ).pipe(Effect.asVoid);
};

const releaseDailySendSlotWithRetry = (
  d1: D1Database,
  dateKey: string,
  logger: {
    error: (message: string) => void;
  },
): Effect.Effect<void, unknown> => {
  return releaseDailySendSlot(d1, dateKey).pipe(
    Effect.catch((releaseError) =>
      Effect.sync(() => {
        const releaseErrorMessage =
          releaseError instanceof Error ? releaseError.message : "Unknown quota rollback error";
        logger.error(`Retrying email quota release after failure: ${releaseErrorMessage}`);
      }).pipe(Effect.andThen(releaseDailySendSlot(d1, dateKey))),
    ),
  );
};

const buildSendPayload = (
  message: SendEmailOptions,
): {
  from: string;
  to: string | string[];
  subject: string;
  replyTo?: string;
  cc?: string[];
  bcc?: string[];
  html?: string;
  text?: string;
  attachments?: EmailAttachment[];
} => {
  const to = resolveAddressList(message.to);
  const cc = resolveAddressList(message.cc);
  const bcc = resolveAddressList(message.bcc);

  assertNoRecipientListDelimiter(to, "to");
  assertNoRecipientListDelimiter(cc, "cc");
  assertNoRecipientListDelimiter(bcc, "bcc");
  assertNoDisplayName(to, "to");
  assertNoDisplayName(cc, "cc");
  assertNoDisplayName(bcc, "bcc");

  const totalRecipientCount = to.length + cc.length + bcc.length;

  if (totalRecipientCount !== 1 || to.length !== 1 || cc.length > 0 || bcc.length > 0) {
    throw new Error(
      "Transactional email requires exactly one `to` recipient and no `cc`/`bcc` recipients",
    );
  }

  if (!message.subject) {
    throw new Error("Email subject is required");
  }

  const from = message.from ? formatAddress(resolveAddress(message.from)) : DEFAULT_FROM_ADDRESS;
  const payload = {
    from,
    to: to[0].address,
    subject: message.subject,
    replyTo: undefined as string | undefined,
    cc: undefined as string[] | undefined,
    bcc: undefined as string[] | undefined,
    html: undefined as string | undefined,
    text: undefined as string | undefined,
    attachments: undefined as EmailAttachment[] | undefined,
  };

  const replyTo = resolveSingleAddress(message.replyTo);
  if (replyTo) payload.replyTo = formatAddress(replyTo);

  if (cc.length > 0) payload.cc = cc.map((addr) => addr.address);

  if (bcc.length > 0) payload.bcc = bcc.map((addr) => addr.address);

  if (message.html) payload.html = message.html.toString();
  if (message.text) payload.text = message.text.toString();

  const attachments = normalizeAttachments(message.attachments);
  if (attachments && attachments.length > 0) {
    payload.attachments = attachments;
  }

  return payload;
};

export const cloudflareEmailAdapter = (
  args: CloudflareEmailAdapterArgs,
): EmailAdapter<EmailSendResult> => {
  return ({ payload }) => ({
    name: "cloudflare-email-sending",
    defaultFromAddress: DEFAULT_FROM_ADDRESS,
    defaultFromName: DEFAULT_FROM_NAME,
    sendEmail: (message): Promise<EmailSendResult> => {
      return Effect.runPromise(
        Effect.gen(function* () {
          const sendPayload = yield* Effect.sync(() => buildSendPayload(message));
          const reservation = yield* reserveDailySendSlot(args.d1);
          yield* Effect.sync(() => {
            payload.logger.info(
              `Email quota usage ${reservation.sendCount}/${DAILY_SEND_LIMIT} for ${reservation.dateKey}`,
            );
          });

          return yield* promiseEffect(() => args.email.send(sendPayload)).pipe(
            Effect.catch((sendError) =>
              releaseDailySendSlotWithRetry(args.d1, reservation.dateKey, payload.logger).pipe(
                Effect.catch((releaseError) =>
                  Effect.sync(() => {
                    const releaseErrorMessage =
                      releaseError instanceof Error
                        ? releaseError.message
                        : "Unknown quota rollback error";
                    payload.logger.error(
                      `Failed to release email quota after send failure: ${releaseErrorMessage}`,
                    );
                  }),
                ),
                Effect.andThen(Effect.fail(sendError)),
              ),
            ),
          );
        }).pipe(
          Effect.tapError((error) =>
            Effect.sync(() => {
              const errorMessage =
                error instanceof Error ? error.message : "Unknown email adapter error";
              payload.logger.error(errorMessage);
            }),
          ),
        ),
      );
    },
  });
};

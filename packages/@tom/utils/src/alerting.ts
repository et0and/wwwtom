import { logger, setErrorCallback, setWaitUntil } from "./logger";
import { initTelegram, telegramAlert } from "./telegram";
import type { TelegramBindings } from "./telegram";

export interface AlertingConfig extends TelegramBindings {
  waitUntil?: (promise: Promise<unknown>) => void;
}

export const setupErrorAlerting = (config: AlertingConfig) => {
  initTelegram(config);

  if (config.waitUntil) {
    setWaitUntil(config.waitUntil);
  }

  setErrorCallback(async (message, error) => {
    await telegramAlert.error(message, error);
  });

  if (typeof self !== "undefined") {
    self.addEventListener("unhandledrejection", (event) => {
      logger.error("Unhandled rejection", event.reason);
    });

    self.addEventListener("error", (event) => {
      logger.error("Uncaught error", event.error);
    });
  }
};

export { logger, telegramAlert };

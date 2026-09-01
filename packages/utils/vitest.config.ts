import { defineConfig } from "vitest/config";
import { loadEnv } from "vite";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  const token = env.TELEGRAM_BOT_TOKEN;
  const chatId = env.TELEGRAM_CHAT_ID;

  return {
    test: {
      environment: "node",
    },
    define: {
      "process.env.TELEGRAM_BOT_TOKEN": JSON.stringify(token),
      "process.env.TELEGRAM_CHAT_ID": JSON.stringify(chatId),
      "import.meta.env.TELEGRAM_BOT_TOKEN": JSON.stringify(token),
      "import.meta.env.TELEGRAM_CHAT_ID": JSON.stringify(chatId),
    },
  };
});

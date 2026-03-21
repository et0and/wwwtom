import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/app/(frontend)/**/*.{js,ts,tsx}", "./src/components/**/*.{js,ts,tsx}"],
  theme: {
    extend: {},
  },
  plugins: [],
};

export default config;

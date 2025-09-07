FROM oven/bun

COPY bun.lock .
COPY package.json .

RUN bun install --frozen-lockfile

COPY . .

RUN bun run build

EXPOSE 3000
CMD ["bun", "start"]
FROM node:24.7.0-bullseye@sha256:1684133274a44010e6d6011d6eec100cf756309678c77700779ac44a5ac36715 AS base

WORKDIR /src

# Build
FROM base as build

COPY --link package.json package-lock.json ./
RUN npm install -g npm@11.5.1
RUN npm install

COPY --link . .

RUN npm run build

# Run
FROM base

ENV PORT=3000
ENV NODE_ENV=production

COPY --from=build /src/.output /src/.output

CMD [ "node", ".output/server/index.mjs" ]
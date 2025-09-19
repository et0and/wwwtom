FROM node:24.8.0-alpine3.21@sha256:f9e76ef2f60fc2003507927805d10e10c78e269186e8111b36f13b0cbe76218c AS base

WORKDIR /src

# Build
FROM base as build

RUN apk add --no-cache git

COPY --link package.json package-lock.json ./
RUN npm install

COPY --link . .

RUN npm run build

# Run
FROM base

ENV PORT=3000
ENV NODE_ENV=production

COPY --from=build /src/.output /src/.output

CMD [ "node", ".output/server/index.mjs" ]
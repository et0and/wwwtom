FROM ocaml/opam:debian-12-ocaml-5.3@sha256:bbaac53e502f6602013d8967c3a54cfcb898b556f453ab72e8e23966c3c681df AS build

USER opam
WORKDIR /home/opam/bundle-checker

ENV OPAM_SWITCH_PREFIX=/home/opam/.opam/5.3 \
    PATH=/home/opam/.opam/5.3/bin:/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin

# Keep the toolchain layer cached while the checker source changes.
COPY --chown=opam:opam dune-project ./
COPY --chown=opam:opam lib/dune ./lib/dune
COPY --chown=opam:opam bin/dune ./bin/dune
COPY --chown=opam:opam test/dune ./test/dune

RUN opam install --yes dune.3.23.1 yojson.3.0.0 \
    && eval "$(opam env)"

COPY --chown=opam:opam lib ./lib
COPY --chown=opam:opam bin ./bin
COPY --chown=opam:opam test ./test

RUN eval "$(opam env)" \
    && dune runtest \
    && dune build bin/main.exe \
    && mkdir -p /home/opam/bin \
    && cp _build/default/bin/main.exe /home/opam/bin/bundle-checker

FROM debian:bookworm-slim@sha256:3783cc01769c7b2b1b83a5c5ad96c815348e28ed7da68e2e3687004faa906251

COPY --from=build /home/opam/bin/bundle-checker /usr/local/bin/bundle-checker
USER nobody:nogroup
WORKDIR /workspace

ENTRYPOINT ["/usr/local/bin/bundle-checker"]

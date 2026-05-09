# syntax=docker/dockerfile:1
# Phoenix / Elixir production image
# Build: docker build -t todo_board_phoenix .
# Run:   docker run -e DATABASE_URL=... -e SECRET_KEY_BASE=... -p 4000:4000 todo_board_phoenix

ARG ELIXIR_VERSION=1.17.2
ARG OTP_VERSION=27.0.1
ARG DEBIAN_VERSION=bookworm-20240904-slim

FROM hexpm/elixir:${ELIXIR_VERSION}-erlang-${OTP_VERSION}-debian-${DEBIAN_VERSION} AS build

RUN apt-get update -y && apt-get install -y build-essential git curl \
    && apt-get clean && rm -rf /var/lib/apt/lists/*

# Install Node for asset compilation
ARG NODE_VERSION=22.11.0
RUN curl -fsSL https://nodejs.org/dist/v${NODE_VERSION}/node-v${NODE_VERSION}-linux-arm64.tar.xz \
    | tar -xJ -C /usr/local --strip-components=1

WORKDIR /app
ENV MIX_ENV=prod

RUN mix local.hex --force && mix local.rebar --force

COPY mix.exs mix.lock ./
RUN mix deps.get --only prod
RUN mix deps.compile

COPY assets/package.json assets/package-lock.json ./assets/
RUN npm --prefix assets install --ignore-scripts 2>/dev/null; true

COPY priv priv
COPY assets assets
RUN mix assets.deploy

COPY lib lib
RUN mix compile

RUN mix release

# ── Runtime image ────────────────────────────────────────────────────────────
FROM debian:${DEBIAN_VERSION}

RUN apt-get update -y && apt-get install -y libstdc++6 openssl libncurses5 locales \
    && apt-get clean && rm -rf /var/lib/apt/lists/*
RUN sed -i '/en_US.UTF-8/s/^# //g' /etc/locale.gen && locale-gen

ENV LANG=en_US.UTF-8 LANGUAGE=en_US:en LC_ALL=en_US.UTF-8
ENV MIX_ENV=prod

WORKDIR /app
RUN chown nobody /app

COPY --from=build --chown=nobody:root /app/_build/prod/rel/todo_board ./

USER nobody

EXPOSE 4000

CMD ["/app/bin/server"]

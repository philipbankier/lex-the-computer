FROM debian:bookworm-slim

RUN apt-get update && apt-get install -y --no-install-recommends \
  curl git build-essential python3 python3-pip ca-certificates \
  && curl -fsSL https://deb.nodesource.com/setup_22.x | bash - \
  && apt-get install -y nodejs \
  && npm install -g pnpm \
  && curl -fsSL https://bun.sh/install | bash \
  && ln -s /root/.bun/bin/bun /usr/local/bin/bun \
  && apt-get clean && rm -rf /var/lib/apt/lists/*

RUN useradd -m -s /bin/bash lexuser

WORKDIR /workspace
RUN chown lexuser:lexuser /workspace

USER lexuser

CMD ["sleep", "infinity"]

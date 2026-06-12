FROM python:3.14-slim

# Node is required because the mkdocs-likec4 plugin shells out to the `likec4` CLI.
ENV NODE_VERSION=22.22.3
RUN set -eux; \
    apt-get update; \
    apt-get install -y --no-install-recommends curl xz-utils ca-certificates; \
    arch="$(dpkg --print-architecture)"; \
    case "$arch" in \
      amd64) node_arch=x64 ;; \
      arm64) node_arch=arm64 ;; \
      *) echo "unsupported arch: $arch" >&2; exit 1 ;; \
    esac; \
    curl -fsSL "https://nodejs.org/dist/v${NODE_VERSION}/node-v${NODE_VERSION}-linux-${node_arch}.tar.xz" -o /tmp/node.tar.xz; \
    tar -xJf /tmp/node.tar.xz -C /usr/local --strip-components=1; \
    rm /tmp/node.tar.xz; \
    apt-get purge -y curl xz-utils; \
    apt-get autoremove -y; \
    rm -rf /var/lib/apt/lists/*

WORKDIR /docs

COPY requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt

COPY package.json package-lock.json ./
RUN npm ci

ENV PATH="/docs/node_modules/.bin:${PATH}"

EXPOSE 8000
# The inline-comments plugin sources arrive via the bind mount, so install at container start.
CMD ["sh", "-c", "pip install -q -e . && mkdocs serve -a 0.0.0.0:8000 --livereload"]

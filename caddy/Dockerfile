# Custom Caddy build with GoDaddy DNS provider module
# Required for wildcard TLS certificates via Let's Encrypt DNS-01 challenge
FROM caddy:2-builder AS builder

RUN xcaddy build \
    --with github.com/caddy-dns/godaddy

FROM caddy:2-alpine

COPY --from=builder /usr/bin/caddy /usr/bin/caddy

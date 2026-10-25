FROM rust:1-bookworm AS build
WORKDIR /app
COPY Cargo.toml ./
COPY src ./src
COPY migrations ./migrations
RUN cargo build --release --bin blue-line-erp-api --bin bootstrap_admin --bin provision_user --bin provision_trade_demo
FROM debian:bookworm-slim
RUN apt-get update && apt-get install -y --no-install-recommends ca-certificates && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY --from=build /app/target/release/blue-line-erp-api /usr/local/bin/blue-line-erp-api
COPY --from=build /app/target/release/bootstrap_admin /usr/local/bin/bootstrap_admin
COPY --from=build /app/target/release/provision_user /usr/local/bin/provision_user
COPY --from=build /app/target/release/provision_trade_demo /usr/local/bin/provision_trade_demo
COPY migrations ./migrations
USER 65532:65532
ENV ERP_LISTEN_ADDR=0.0.0.0:8085
EXPOSE 8085
CMD ["blue-line-erp-api"]

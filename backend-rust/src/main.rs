use std::{env,net::SocketAddr};
use axum::{Router,routing::{get,post},http::{HeaderValue,Method,header},extract::DefaultBodyLimit,middleware};
use tower_http::{cors::{CorsLayer,AllowOrigin},trace::TraceLayer};
use sqlx::postgres::PgPoolOptions;
use blue_line_erp_api::{AppState,routes,evidence,trade,partial,returns,warehouse,finance,hospitality,fx,industry,hr,security};

#[tokio::main]
async fn main() -> Result<(),Box<dyn std::error::Error>> {
    tracing_subscriber::fmt().with_env_filter(tracing_subscriber::EnvFilter::try_from_default_env().unwrap_or_else(|_|"info".into())).init();
    let database_url=env::var("DATABASE_URL").map_err(|_|"DATABASE_URL must be set")?;
    let pool=PgPoolOptions::new().max_connections(10).connect(&database_url).await?;
    // RC12 hard gate: NEVER alter a production schema implicitly at API startup.
    // A disposable development environment can opt in; all other environments must
    // apply audited migrations separately and have the precise checkpoint version.
    let auto_migrate=env::var("ERP_AUTO_MIGRATE").ok().as_deref()==Some("true");
    if auto_migrate {
        if env::var("ERP_ENV").ok().as_deref()!=Some("development") {
            return Err("ERP_AUTO_MIGRATE is allowed only when ERP_ENV=development".into());
        }
        let migrations_dir=std::path::Path::new(env!("CARGO_MANIFEST_DIR")).join("migrations");
        let migrator=sqlx::migrate::Migrator::new(migrations_dir.as_path()).await?;
        migrator.run(&pool).await?;
    }
    // Fail closed when the DB is missing, dirty, older, or ahead of this source.
    // No server endpoints become available before this check succeeds.
    let applied_versions:Vec<i64>=sqlx::query_scalar(
        "SELECT version FROM _sqlx_migrations WHERE success=true ORDER BY version"
    ).fetch_all(&pool).await.map_err(|_|"Missing SQLx migration history: run migrations before starting API")?;
    let failed:i64=sqlx::query_scalar(
        "SELECT count(*)::bigint FROM _sqlx_migrations WHERE success=false"
    ).fetch_one(&pool).await?;
    let expected_versions:Vec<i64>=(1..=12).collect();
    if failed>0 || applied_versions!=expected_versions {
        return Err(format!("Unsafe schema: migration history={applied_versions:?}, failures={failed}; RC20 requires every migration 1..12").into());
    }

    let cors_origins=env::var("ERP_ALLOWED_ORIGINS").unwrap_or_default();
    let origins:Vec<HeaderValue>=cors_origins.split(',').filter(|s|!s.trim().is_empty())
        .map(|s|HeaderValue::from_str(s.trim())).collect::<Result<Vec<_>,_>>()?;
    let cors=CorsLayer::new().allow_origin(AllowOrigin::list(origins))
        .allow_methods([Method::GET,Method::POST,Method::OPTIONS])
        .allow_headers([header::CONTENT_TYPE,header::AUTHORIZATION,header::HeaderName::from_static("idempotency-key")]);
    let app=Router::new()
        .route("/health",get(routes::health))
        .route("/api/v1/login",post(routes::login))
        .route("/api/v1/logout",post(routes::logout))
        .route("/api/v1/me",get(routes::me))
        .route("/api/v1/entity",get(routes::entities))
        .route("/api/v1/modules",get(routes::modules))
        .route("/api/v1/overview",get(evidence::overview))
        .route("/api/v1/audit-events",get(evidence::audit_feed))
        .route("/api/v1/records",get(routes::list_records).post(routes::create_record))
        .route("/api/v1/records/{id}",get(evidence::record_detail))
        .route("/api/v1/records/{id}/transition",post(routes::transition))
        .route("/api/v1/journals",get(routes::list_journals).post(routes::create_journal))
        .route("/api/v1/journals/{id}",get(evidence::journal_detail))
        .route("/api/v1/journals/{id}/post",post(routes::post_journal))
        .route("/api/v1/trade/catalog",get(trade::catalog))
        .route("/api/v1/trade/catalog/items",post(trade::create_item))
        .route("/api/v1/trade/catalog/warehouses",post(trade::create_warehouse))
        .route("/api/v1/trade/posting-accounts",post(trade::map_account))
        .route("/api/v1/trade/movements",get(trade::movements))
        .route("/api/v1/purchasing/orders",get(trade::purchases).post(trade::create_purchase))
        .route("/api/v1/purchasing/orders/{id}/approve",post(trade::approve_purchase))
        .route("/api/v1/purchasing/orders/{id}/receive",post(trade::receive_purchase))
        .route("/api/v1/sales/orders",get(trade::sales).post(trade::create_sale))
        .route("/api/v1/sales/orders/{id}/approve",post(trade::approve_sale))
        .route("/api/v1/sales/orders/{id}/ship",post(trade::ship_sale))
        .route("/api/v1/purchasing/orders/{id}/lines",get(partial::purchase_lines))
        .route("/api/v1/sales/orders/{id}/lines",get(partial::sale_lines))
        .route("/api/v1/purchasing/orders/{id}/receive-partial",post(partial::receive_partial))
        .route("/api/v1/sales/orders/{id}/ship-partial",post(partial::ship_partial))
        .route("/api/v1/trade/fulfilments",get(partial::fulfilments))
        .route("/api/v1/inventory/transfers",get(warehouse::transfers).post(warehouse::submit_transfer))
        .route("/api/v1/inventory/transfers/{id}/approve",post(warehouse::approve_transfer))
        .route("/api/v1/inventory/counts",get(warehouse::counts).post(warehouse::submit_count))
        .route("/api/v1/inventory/counts/{id}/approve",post(warehouse::approve_count))
        .route("/api/v1/construction/projects",get(industry::projects).post(industry::create_project))
        .route("/api/v1/construction/progress",get(industry::progress).post(industry::submit_progress))
        .route("/api/v1/construction/progress/{id}/approve",post(industry::approve_progress))
        .route("/api/v1/manufacturing/batches",get(industry::batches).post(industry::create_batch))
        .route("/api/v1/manufacturing/batches/{id}/complete",post(industry::complete_batch))
        .route("/api/v1/manufacturing/batches/{id}/qc",post(industry::qc_batch))
        .route("/api/v1/manufacturing/batches/{id}/release",post(industry::release_batch))
        .route("/api/v1/import/dossiers",get(industry::imports).post(industry::create_import))
        .route("/api/v1/import/dossiers/{id}/verify",post(industry::verify_import))
        .route("/api/v1/hospitality/properties",get(hospitality::properties).post(hospitality::create_property))
        .route("/api/v1/hospitality/rooms",get(hospitality::rooms).post(hospitality::create_room))
        .route("/api/v1/hospitality/reservations",get(hospitality::bookings).post(hospitality::create_booking))
        .route("/api/v1/hospitality/reservations/{id}/check-in",post(hospitality::check_in))
        .route("/api/v1/hospitality/reservations/{id}/check-out",post(hospitality::check_out))
        .route("/api/v1/property/leases",get(hospitality::leases).post(hospitality::create_lease))
        .route("/api/v1/blex/quotes",get(fx::quotes).post(fx::create_quote))
        .route("/api/v1/finance/accounts",post(finance::map_account))
        .route("/api/v1/finance/invoices",get(finance::invoices).post(finance::create_invoice))
        .route("/api/v1/finance/invoices/{id}/issue",post(finance::issue_invoice))
        .route("/api/v1/finance/receipts",get(finance::receipts).post(finance::create_receipt))
        .route("/api/v1/finance/receipts/{id}/match",post(finance::match_receipt))
        .route("/api/v1/finance/bank-lines",get(finance::bank_lines).post(finance::create_bank_line))
        .route("/api/v1/hr/employees",get(hr::employees).post(hr::add_employee))
        .route("/api/v1/hr/attendance",get(hr::attendance).post(hr::log_attendance))
        .route("/api/v1/hr/attendance/{id}/accept",post(hr::accept_attendance))
        .route("/api/v1/hr/leaves",get(hr::leaves).post(hr::submit_leave))
        .route("/api/v1/hr/leaves/{id}/review",post(hr::review_leave))
        .route("/api/v1/hr/payroll-previews",get(hr::payroll).post(hr::create_payroll))
        .route("/api/v1/hr/payroll-previews/{id}/manager-review",post(hr::payroll_review))
        .route("/api/v1/hr/payroll-previews/{id}/finance-verify",post(hr::payroll_verify))
        .route("/api/v1/bridge/overview",get(hr::bridge))
        .route("/api/v1/security/permissions",get(security::permissions))
        .route("/api/v1/security/revoke-self",post(security::revoke_self))
        .route("/api/v1/security/users/{id}/revoke",post(security::revoke_member))
        .route("/api/v1/security/events",get(security::security_feed))
        .route("/api/v1/trade/returns",get(returns::list_returns))
        .route("/api/v1/trade/fulfilments/{id}/return",post(returns::create_return))
        .route("/api/v1/trade/fulfilments/{id}/returnable",get(returns::returnable))
        .layer(DefaultBodyLimit::max(64*1024))
        .layer(middleware::from_fn_with_state(AppState{pool:pool.clone()}, security::access_gate))
        .layer(TraceLayer::new_for_http())
        .layer(cors)
        .with_state(AppState{pool});
    let addr:SocketAddr=env::var("ERP_LISTEN_ADDR").unwrap_or_else(|_|"127.0.0.1:8085".into()).parse()?;
    let listener=tokio::net::TcpListener::bind(addr).await?;
    tracing::info!(%addr,"Blue Line Rust ERP API RC20 checkpoint listening");
    axum::serve(listener,app).await?;
    Ok(())
}

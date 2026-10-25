pub mod auth;
pub mod error;
pub mod routes;
pub mod workflow;
pub mod journal;
pub mod evidence;
pub mod trade;
pub mod partial;
pub mod returns;
pub mod warehouse;
pub mod finance;
pub mod hospitality;
pub mod fx;
pub mod industry;

use sqlx::PgPool;

#[derive(Clone)]
pub struct AppState { pub pool: PgPool }

pub const MODULE_KEYS: [&str;9] = ["holding", "blex", "property", "construction", "sugar", "trade", "finance", "hr", "digital"];

pub fn is_module(input: &str) -> bool { MODULE_KEYS.contains(&input) }

pub mod hr;
pub mod policy;
pub mod security;

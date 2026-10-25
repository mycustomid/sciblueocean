use axum::{http::StatusCode, response::{IntoResponse,Response}, Json};
use serde_json::json;

#[derive(Debug)]
pub struct ApiError { pub status: StatusCode, pub code: &'static str, pub message: String }

impl ApiError {
    pub fn new(status: StatusCode, code: &'static str, message: impl Into<String>) -> Self {
        Self { status, code, message: message.into() }
    }
    pub fn bad(msg: impl Into<String>) -> Self { Self::new(StatusCode::BAD_REQUEST,"INVALID_INPUT",msg) }
    pub fn forbidden() -> Self { Self::new(StatusCode::FORBIDDEN,"FORBIDDEN","Permission denied for this legal entity") }
    pub fn unauthorized() -> Self { Self::new(StatusCode::UNAUTHORIZED,"UNAUTHORIZED","Valid bearer session required") }
    pub fn conflict(msg: impl Into<String>) -> Self { Self::new(StatusCode::CONFLICT,"CONFLICT",msg) }
    pub fn not_found() -> Self { Self::new(StatusCode::NOT_FOUND,"NOT_FOUND","Resource not found") }
    pub fn db(err: sqlx::Error) -> Self {
        tracing::error!(error=%err,"database operation failed");
        Self::new(StatusCode::INTERNAL_SERVER_ERROR,"DATABASE_ERROR","Database operation could not complete")
    }
}
impl IntoResponse for ApiError {
    fn into_response(self) -> Response { (self.status, Json(json!({"error":self.code,"message":self.message}))).into_response() }
}

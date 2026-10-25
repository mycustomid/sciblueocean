//! RC17 explicit module-scoped access for generic domain_records. No group_admin override.
use crate::{auth::Auth,error::ApiError,MODULE_KEYS};
/// Pilot policy only; a full permissions matrix and RLS remain release blockers.
pub fn can_module(role:&str,module:&str,write:bool)->bool{
 if !MODULE_KEYS.contains(&module){return false}
 match module {
  "hr" => if write {matches!(role,"hr"|"hr_manager")}else{matches!(role,"hr"|"hr_manager"|"finance"|"auditor")},
  "finance" => if write {role=="finance"}else{matches!(role,"finance"|"auditor"|"executive")},
  "digital" => if write {role=="group_admin"}else{matches!(role,"group_admin"|"executive"|"auditor")},
  "holding" => if write {role=="executive"}else{matches!(role,"executive"|"auditor"|"finance")},
  _ => if write {matches!(role,"operator"|"manager"|"finance")}else{matches!(role,"operator"|"manager"|"finance"|"auditor"|"executive")},
 }
}
pub fn ensure_module(auth:&Auth,module:&str,write:bool)->Result<(),ApiError>{
 if can_module(&auth.role,module,write){Ok(())}else{Err(ApiError::forbidden())}
}
pub fn visible_modules(auth:&Auth)->Vec<String>{MODULE_KEYS.iter().filter(|key|can_module(&auth.role,key,false)).map(|s|(*s).into()).collect()}
#[cfg(test)]mod tests {use super::*;
 #[test]fn admin_is_not_business_superuser(){assert!(!can_module("group_admin","finance",true));assert!(!can_module("group_admin","hr",false));assert!(can_module("group_admin","digital",true));}
 #[test]fn restricted_hr_payroll(){assert!(can_module("hr","hr",true));assert!(!can_module("operator","hr",false));assert!(!can_module("hr","finance",false));}
 #[test]fn fail_closed_unknown(){assert!(!can_module("executive","surprise",false));}
}

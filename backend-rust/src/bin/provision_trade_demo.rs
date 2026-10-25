//! CLI to install UNVERIFIED demo GL codes for the RC8 local sandbox ONLY.
use std::env;
use sqlx::{PgPool,Row};
use uuid::Uuid;

#[tokio::main]
async fn main()->Result<(),Box<dyn std::error::Error>>{
    if env::var("TRADE_DEMO_ACK").as_deref()!=Ok("I_UNDERSTAND_DEMO_ONLY"){
        return Err("Set TRADE_DEMO_ACK=I_UNDERSTAND_DEMO_ONLY; this CLI is not for certified accounts".into());
    }
    let entity_id=Uuid::parse_str(&env::var("PROVISION_ENTITY_ID")?)?;
    let url=env::var("DATABASE_URL")?;
    let pool=PgPool::connect(&url).await?;
    let mut tx=pool.begin().await?;
    let rows=[
        ("31", "UNVERIFIED DEMO Inventory", "inventory"),
        ("401", "UNVERIFIED DEMO Accounts Payable", "accounts_payable"),
        ("411", "UNVERIFIED DEMO Accounts Receivable", "accounts_receivable"),
        ("701", "UNVERIFIED DEMO Sales Revenue", "sales_revenue"),
        ("603", "UNVERIFIED DEMO Cost of Goods Sold", "cost_of_goods_sold"),
    ];
    for (code,label,role) in rows{
        sqlx::query("INSERT INTO gl_accounts(entity_id,code,label) VALUES($1,$2,$3) ON CONFLICT(entity_id,code) DO NOTHING")
            .bind(entity_id).bind(code).bind(label).execute(&mut *tx).await?;
        let account=sqlx::query("SELECT id,active FROM gl_accounts WHERE entity_id=$1 AND code=$2")
            .bind(entity_id).bind(code).fetch_one(&mut *tx).await?;
        if !account.get::<bool,_>("active") {return Err("Existing GL code disabled".into())}
        sqlx::query("INSERT INTO trade_posting_accounts(entity_id,posting_role,account_id) VALUES($1,$2,$3) ON CONFLICT(entity_id,posting_role) DO UPDATE SET account_id=EXCLUDED.account_id")
            .bind(entity_id).bind(role).bind(account.get::<Uuid,_>("id")).execute(&mut *tx).await?;
    }
    tx.commit().await?;
    println!("Demo-only trade mappings installed for {entity_id}; accountant approval still required before any real posting.");
    Ok(())
}

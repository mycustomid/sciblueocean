#!/usr/bin/env python3
"""RC12 deterministic static preflight. Does NOT assert cargo/PG execution."""
from pathlib import Path
from subprocess import run
import sys
root=Path(__file__).resolve().parent.parent
versions=[p.name[:4] for p in sorted((root/'backend-rust/migrations').glob('*.sql'))]
assert versions==['0001','0002','0003','0004','0005','0006','0007'],versions
assert (root/'backend-rust/src/warehouse.rs').exists()
assert (root/'backend-rust/tests/pg_rc12_warehouse.rs').exists()
assert (root/'.github/workflows/rc12-warehouse-gate.yml').exists()
print('RC12 SOURCE PREFLIGHT: seven migrations + Rust warehouse + PG test + CI gate present')
result=run(['node','--test',*[str(p) for p in sorted((root/'tests').glob('*.test.mjs'))]],cwd=root,check=False)
if result.returncode:sys.exit(result.returncode)
print('RC12 NODE TESTS PASS; real cargo/PostgreSQL release gate NOT EXECUTED here')

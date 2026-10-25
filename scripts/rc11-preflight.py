#!/usr/bin/env python3
"""RC11 static preflight + Node regression; does NOT compile Rust or run PG."""
from pathlib import Path
from subprocess import run
import json,sys
import yaml
root=Path(__file__).resolve().parent.parent
backend=root/'backend-rust'
assert backend.joinpath('Cargo.toml').exists(), 'Run from extracted RC11 overlay'
migrations=sorted(backend.joinpath('migrations').glob('*.sql'))
assert [p.name[:4] for p in migrations]==['0001','0002','0003','0004','0005','0006','0007']
for x in ['src/main.rs','src/journal.rs','tests/pg_rc11_period.rs']:
 assert backend.joinpath(x).is_file(), x
workflows=list((root/'.github/workflows').glob('*.yml'))
for f in workflows:
 data=yaml.safe_load(f.read_text())
 assert isinstance(data,dict) and data.get('jobs'), f
assert (root/'.github/workflows/rc11-rust-postgres-gate.yml').is_file()
print(f'STATIC: {len(migrations)} migrations; {len(workflows)} valid GitHub Actions YAML files')
result=run(['node','--test',*[str(p) for p in sorted((root/'tests').glob('*.test.mjs'))]],cwd=root,check=False)
if result.returncode: raise SystemExit(result.returncode)
print('PASS: static schema workflow structure & Node regression. Rust compilation and live PG remain unverified.')

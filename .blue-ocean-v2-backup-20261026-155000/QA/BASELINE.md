# Source control baseline

- Target GitHub `mycustomid/sciblueocean`: `587a00a77ab5397ed7ec657aa394a48dbfefa6a7`, verified via connected repository access on October 26, 2026.
- Live client site observed from browser tab: `https://sciblueocean.com/` with three advertised residences and reservation-request flow. **This is not the same deployment as the audited GitHub project**.
- Existing repo Astro 5.16 / Tailwind 4, `src/pages/index.astro` redirects to `/workspace/`; `public/workspace` role-based ERP UI remains; `backend-rust/` exists. No content in either is removed by patch.
- Installer refuses newer HEAD until manually rebased. Git clone from container DNS unavailable; source baseline obtained via connected GitHub.

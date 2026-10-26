# Install to existing repo — HEAD-pinned overlay

Baseline commit must be `c0c3eda9be41dc574e9b09e51654436d50a88031`. Do NOT use original old install script/ZIP. Existing `/experience/`, `/studio/`, `/workspace/`, original client photo assets are present in HEAD.

1. Keep Git working tree clean. Run `bash scripts/apply.sh /path/to/sciblueocean --dry-run`. Review every affected file.
2. Apply `bash scripts/apply.sh /path/to/sciblueocean --apply` locally. The script copies changed HTML/CSS/JS, creates a backup for every overwritten file and skips unchanged original logo/media; it does **not** overwrite assets or touch old ERP/backend directories.
3. Run `npm ci && npm run build` in the real repo, and preview on a separate staging URL. Test first-party network resources, mobile 390px, desktop 1440px, forms, language menu, email flow, payment gating and 9-product ERP link boundaries.
4. `git diff --stat` then `git diff` before commit. No automatic push/deploy.
5. Rollback: restore all paths from `.blue-ocean-v2-backup-YYYYMMDD-HHMMSS/` and remove only new files documented by dry-run (such as payment route and refined CSS). Do not remove existing repo photo/media.

All API tests in package run only against demo-server local stdlib backend; **never run demo password/session design on a public staging server**.

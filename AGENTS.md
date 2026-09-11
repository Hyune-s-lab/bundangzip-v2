<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

## Deployment

- GitHub repository: `Hyune-s-lab/bundangzip-v2`.
- Work on `codex/` branches and merge into `main` for production deployment through Vercel's Git integration.
- Only `main` triggers automatic Vercel deployments; Preview deployments are disabled in `vercel.json`. Validate changes locally before merging; do not wait for a Preview deployment.
- Do not upload production deployments manually with `vercel deploy`.
- Keep secrets, local opinion data, and private reference assets out of Git. Production secrets remain in Vercel.

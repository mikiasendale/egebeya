# Contributing

## Local development

```bash
# Install dependencies
npm install

# Copy the env template and fill in the values you need
cp .env.example .env

# Run the dev server (Express + Vite middleware)
npm run dev
# → http://localhost:3000

# Seed test data (plans, demo tenants)
npm run seed
```

The dev server uses Vite's middleware mode, so React hot-reloads work and the
Express API is served on the same port.

## Testing

```bash
# Run the full suite
npm test

# Watch mode (re-runs on file change)
npx vitest

# TypeScript check (type-level lint, no emit)
nnpm run lint
```

Tests are integration-style (supertest mounts the Express router against the
local `sqlite.db`). They create and clean up test tenants + users, so they
leave the database in a clean state. Platform-team members: run `npm test`
before pushing.

## CI

GitHub Actions runs `npm run lint && npm test` on every push and PR to
`main`/`master` (`.github/workflows/test.yml`). If either command fails the
PR is blocked from merging.

## Deploying

### Staging

Push to `main` — the CI workflow runs tests. If they pass, deploy the branch
locally (Plesk or Cloud Run) by building the server bundle:

```bash
n run build
# outputs: dist/server.cjs + static SPA assets into dist/
```

### Production

Same as staging. On Plesk, point the document root to the `dist/` directory
and set the Node.js Application Startup File to `dist/server.cjs`.

Typical Plesk layout:

```
/var/www/vhosts/yourdomain.com/httpdocs/   ← git working tree
  dist/                                    ← build output
  dist/server.cjs                          ← esbuild bundle
```

### Wildcard subdomains

Add a wildcard `*.yourdomain.com` DNS A record to the server IP. In Plesk,
add a Subdomain named `*` that points to the same document root. The Express
server resolves tenant slugs from the `Host` header's first label.
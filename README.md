# Arsh Traders Challan Tracker

Internal inventory and challan tracking tool for Arsh Traders.

## Runtime Requirements

- Node.js 20
- Supabase project with Postgres 17
- Supabase CLI for database migrations

## Environment

Copy `.env.example` to `.env.local` for local development and fill the Supabase
values from the active project:

```bash
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
NEXT_PUBLIC_APP_URL=
AUTH_ALLOWED_EMAILS=
AUTH_ALLOWED_DOMAINS=
AUTH_REQUIRE_ALLOWLIST=true
```

Keep the service role key only in server-side environment variables. Do not expose
it in browser code or commit it to git.

## Supabase Setup

Create or choose a Supabase project, then link this repo:

```bash
supabase link --project-ref <project-ref>
supabase db push --include-all
npm run check:supabase
```

The migration creates the required tables, indexes, outstanding-items view, RLS
defaults, and the Arsh Traders warehouse location.

For authentication, configure the deployed app URL in Supabase Auth redirect
URLs:

```text
<deployed-app-url>/auth/callback
```

Also set `AUTH_ALLOWED_EMAILS` to the small list of internal user email
addresses that can access the system.

## Local Development

```bash
npm install
npm run check:supabase
npm run dev
```

## Deployment

Least-cost reliable setup for up to 5 internal users:

- Supabase Pro for production Postgres and Auth so the database does not pause
  and automatic backups are available.
- Netlify or Vercel free/hobby deployment for the Next.js app.
- Server-side env vars set in the hosting dashboard.
- Database changes shipped only through `supabase/migrations`.

Supabase Free can be used for development or a zero-cost pilot, but it should not
be treated as the reliable long-running production database.

Before deploying:

```bash
npm run lint
npx tsc --noEmit --pretty false
npm run build
npm run check:supabase
```

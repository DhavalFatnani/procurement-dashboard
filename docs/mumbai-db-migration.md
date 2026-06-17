# Runbook — Move the database to Mumbai (`ap-south-1`), preserving data

Goal: cut DB round-trip latency by moving off the Supabase **Sydney** (`ap-southeast-2`)
project onto a new **Mumbai** (`ap-south-1`) project, **keeping all existing data and user
logins** (Path A — preserve data).

Measured TCP RTT from a Mumbai/IST dev machine (2026-06-05):

| Database | Avg RTT | Warm |
|---|---|---|
| Supabase Sydney (current) | 336 ms | ~290 ms |
| **Supabase Mumbai `ap-south-1`** | **74 ms** | **~40–60 ms** |

A typical detail page fires ~10 queries; on a warm pool that is ~10×(290→50) ms saved per
page. Production users (also in India) benefit identically.

> **No application code changes.** The runtime uses the `@prisma/adapter-pg` (node-postgres)
> adapter against a standard Postgres `postgres://` URL ([lib/prisma.ts](../lib/prisma.ts)).
> Only connection strings + Supabase API keys change. Accelerate is **not** involved.

---

## Why this is a two-part copy (data + identities)

`User.id` **is** the Supabase Auth user UUID:

- `prisma/seed.ts` stores `admin.auth.admin.createUser()`'s returned `data.user.id` as `User.id`.
- `lib/sync-auth-users.ts` upserts `prisma.user` with `id: authUser.id`.
- Domain rows (`PurchaseRequest.createdById`, `PurchaseOrder.*`, `Vendor.createdById`, …) FK to
  `User.id`.

But — confirmed from [prisma/schema.prisma](../prisma/schema.prisma) and the init migration —
`public.User.id` is a bare `String @id` with **no database FK to `auth.users`** (its only FK is
`warehouseId → Warehouse`). The whole Prisma schema lives in `public`. Therefore:

1. **Restoring `public` (schema + data) preserves all app data and its integrity**, by itself.
   The `User` rows keep their UUIDs.
2. **`auth.users` + `auth.identities` data is restored separately**, only so existing users can
   still log in and so their auth UUIDs match the restored `User` rows.
3. There is **no cross-schema FK**, so restore order between `public` and `auth` does not matter
   for integrity (within `auth`, identities reference users, so users load first).

This is why we dump `public` in full but `auth` **data-only** — a new Supabase project already
has the `auth` *tables*; we only need to add the *rows*.

---

## Step 0 — Prerequisites

- Supabase access to create a project. **Do not modify/delete the Sydney project until the new
  one is verified** — it is your instant rollback.
- Local Postgres client tools (present: `psql`/`pg_dump` 18.x at `/opt/homebrew/opt/libpq/bin`).
- Back up the current env file: `cp .env.local .env.local.sydney.bak`.

## Step 1 — Create the Mumbai project

Supabase dashboard → New project → **Region: `South Asia (Mumbai) ap-south-1`** → set/save a
strong DB password → wait for provisioning.

**Pre-flight compatibility check** (avoids auth COPY column mismatches):
```bash
OLD_DIRECT="postgresql://postgres:<OLD_PWD>@db.<OLD_REF>.supabase.co:5432/postgres"
NEW_DIRECT="postgresql://postgres:<NEW_PWD>@db.<NEW_REF>.supabase.co:5432/postgres"

# Postgres major versions should match (or new >= old)
psql "$OLD_DIRECT" -c "show server_version;"
psql "$NEW_DIRECT" -c "show server_version;"

# auth.users column set should be identical between projects
psql "$OLD_DIRECT" -Atc "select string_agg(column_name,',' order by ordinal_position) from information_schema.columns where table_schema='auth' and table_name='users';"
psql "$NEW_DIRECT" -Atc "select string_agg(column_name,',' order by ordinal_position) from information_schema.columns where table_schema='auth' and table_name='users';"
```
If the `auth.users` column lists differ, the projects are on different GoTrue versions — see the
"auth column mismatch" note in Troubleshooting before proceeding.

## Step 2 — Collect the new project's connection strings & keys

From the dashboard:

- **Settings → Database → Connection string:**
  - **Transaction pooler** (port `6543`) → `DATABASE_URL` (`...pooler.supabase.com:6543/postgres?pgbouncer=true`)
  - **Session pooler** (port `5432`) → `DIRECT_URL`
  - **Direct connection** (`db.<NEW_REF>.supabase.co:5432`) → used **only** for dump/restore below
    (poolers can't do schema dump/restore).
- **Settings → API:** Project URL → `NEXT_PUBLIC_SUPABASE_URL`; publishable/anon key →
  `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`; secret/service_role key → `SUPABASE_SECRET_KEY`.

---

## Step 3 — Dump from Sydney (direct connection)

Use the **direct** connection (`db.<OLD_REF>.supabase.co:5432`), never the pooler.

```bash
OLD_DIRECT="postgresql://postgres:<OLD_PWD>@db.<OLD_REF>.supabase.co:5432/postgres"

# 3a. App data + schema (everything in public, incl. _prisma_migrations + sequences)
pg_dump "$OLD_DIRECT" \
  --schema=public \
  --no-owner --no-privileges --quote-all-identifiers \
  --file=public_dump.sql

# 3b. Auth identities, DATA ONLY (preserves UUIDs + credentials; --disable-triggers
#     prevents GoTrue side-effects firing during the COPY)
pg_dump "$OLD_DIRECT" \
  --data-only --disable-triggers \
  --table=auth.users --table=auth.identities \
  --no-owner --quote-all-identifiers \
  --file=auth_data.sql
```

> If you use Supabase **Storage**, also dump `--schema=storage` data-only for the bucket/object
> metadata. If not, skip it.

## Step 4 — Restore into Mumbai (direct connection)

Order: **auth users first** (so identities' intra-schema FK resolves), then app data. (App data
has no FK to auth, so this order is for cleanliness, not correctness.)

```bash
NEW_DIRECT="postgresql://postgres:<NEW_PWD>@db.<NEW_REF>.supabase.co:5432/postgres"

# 4a. Auth rows into the new project's existing auth tables
psql "$NEW_DIRECT" --single-transaction --set ON_ERROR_STOP=1 --file=auth_data.sql

# 4b. App schema + data into the empty public schema
psql "$NEW_DIRECT" --single-transaction --set ON_ERROR_STOP=1 --file=public_dump.sql
```

**Do not** run `pnpm db:migrate:deploy` or `pnpm db:seed` on this path — the dump already carries
the schema, the data, and a populated `_prisma_migrations` (so Prisma sees the DB as fully
migrated).

Regenerate the client locally (connection-agnostic, harmless):
```bash
pnpm db:generate
```

## Step 5 — Repoint `.env.local` at Mumbai

```ini
NEXT_PUBLIC_SUPABASE_URL="https://<NEW_REF>.supabase.co"
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY="<new publishable key>"
SUPABASE_SECRET_KEY="<new secret/service_role key>"
DATABASE_URL="postgresql://postgres.<NEW_REF>:<PWD>@aws-0-ap-south-1.pooler.supabase.com:6543/postgres?pgbouncer=true"
DIRECT_URL="postgresql://postgres.<NEW_REF>:<PWD>@aws-0-ap-south-1.pooler.supabase.com:5432/postgres"
# Production (Vercel): DB_POOL_MAX=3 — keeps per-instance pg pool small on serverless.
# Never point DATABASE_URL at port 5432 (session pooler); app runtime uses 6543 only.
# keep existing: SEED_AUTH_PASSWORD, ALLOW_LOCAL_DB_PARALLEL
```
(Exact pooler host/username comes from the dashboard connection string; `ap-south-1` poolers are
typically `aws-0-ap-south-1.pooler.supabase.com`.)

## Step 6 — Verify before touching production

```bash
# Row-count parity vs Sydney (run the same against OLD_DIRECT to compare)
psql "$NEW_DIRECT" -c 'select
  (select count(*) from "User")            as users,
  (select count(*) from "PurchaseRequest") as prs,
  (select count(*) from "PurchaseOrder")   as pos,
  (select count(*) from "Vendor")          as vendors;'
psql "$NEW_DIRECT" -Atc "select count(*) from auth.users;"   # should match Sydney

pnpm dev
```

- **Log in with an existing account** (real credentials, not seed) — proves `auth.users` +
  `auth.identities` carried over.
- Open a PR / PO / invoices page **twice** (2nd load = warm). Confirm the `⏱` labels
  (`query.fetchPRById`, `PO.*`, `GRN.*`, `invoice.*`) drop from hundreds of ms toward tens.
- Open a PR and confirm it shows its original `createdBy` name (proves UUID continuity end-to-end).

## Step 7 — Production (Vercel)

1. Update the same five vars (+ `SEED_AUTH_PASSWORD` if used) in **Vercel → Settings →
   Environment Variables** (Production + Preview).
2. Set the project's **Function region to `bom1` (Mumbai)** so compute sits next to the DB.
3. Redeploy; smoke-test login + one detail page.
4. New project = new JWT secret → existing browser sessions are invalidated; users re-login once.
   Expected.

## Step 8 — Decommission

After 24–48 h stable on Mumbai, pause/delete the Sydney project. Archive `public_dump.sql` and
`auth_data.sql`.

---

## Rollback

Instant: `cp .env.local.sydney.bak .env.local` (and revert Vercel vars) → redeploy. No code
changed, so nothing else to undo.

## Troubleshooting

- **`auth_data.sql` COPY fails on column count / "extra data"** → the two projects are on
  different GoTrue versions (Step 1 check). Fix by dumping with an explicit shared column list:
  ```bash
  pg_dump "$OLD_DIRECT" --data-only --disable-triggers \
    --table=auth.users --table=auth.identities --column-inserts \
    --no-owner --quote-all-identifiers --file=auth_data.sql
  ```
  `--column-inserts` emits `INSERT (col, …)` statements that tolerate differing column sets
  (slower, but robust). Re-run Step 4a.
- **`public_dump.sql` errors with "extension … already exists" / "schema already exists"** →
  harmless Supabase defaults; they don't abort with the data because objects are additive. If a
  `CREATE EXTENSION` line fails, confirm the extension exists in the new project
  (`select * from pg_extension;`) and re-run; Prisma's schema only needs standard types.
- **Login works but app shows no user / wrong role** → the `User` row didn't restore or RLS
  blocked it. App tables have **no RLS** (Prisma-managed); confirm `select count(*) from "User"`
  matches Sydney. If a user exists in `auth.users` but not `public.User`, run
  `pnpm db:sync-auth-users` to backfill the `User` row from auth.
- **Restore is slow / times out on the pooler** → you used the pooler; use the **direct**
  `db.<REF>.supabase.co:5432` connection for `pg_dump`/`psql`.

## Fallback (only if data preservation proves impractical)

Empty Mumbai DB → `pnpm db:migrate:deploy` → `pnpm db:seed` (creates fresh auth users + demo
data, all UUID-consistent). This **loses Sydney data** — use only as a last resort.

> Prisma Postgres (`db.prisma.io`) is **not** a target: the instance is empty and `migrate deploy`
> fails against it. This runbook targets Supabase only.

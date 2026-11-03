# Deploying Tripdub

The database (Supabase project `tripdub`, ref `wgdanakelnshzoznvfst`) is already set up. Deploying the site takes two steps.

## 1. Create the server secret (Supabase)

Open the Supabase dashboard, go to the `tripdub` project, then **SQL Editor**, and run:

```sql
with s as (select encode(extensions.gen_random_bytes(32), 'hex') as secret)
update private.server_config
   set secret_hash = encode(extensions.digest((select secret from s), 'sha256'), 'hex')
returning (select secret from s) as db_server_secret;
```

Copy the `db_server_secret` value it returns. The database only keeps its hash, so if you lose the value, run the query again and update Vercel with the new one.

## 2. Import the repo on Vercel

1. Go to https://vercel.com/new and import `harry66u/Tripdub`. The framework is detected as Next.js; keep the defaults.
2. Under **Environment Variables**, add:

| Name | Value |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | `https://wgdanakelnshzoznvfst.supabase.co` |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | `sb_publishable_9Hk-PBjlyKfyhaIuU4TYAQ_KulNR4RH` |
| `NEXT_PUBLIC_SITE_URL` | your site's domain, e.g. `tripdub.vercel.app` |
| `DB_SERVER_SECRET` | the value from step 1 |

3. Click **Deploy**.

Vercel deploys the repository's default branch to production. Right now that's `claude/sleepy-mayer-7z5689`, which has the game. After you merge the pull request, set `main` as the default branch on GitHub (Settings, then General) and as the production branch on Vercel (Settings, then Git).

## Checking it works

Play a game at `/starting-five`. The results screen should show "Top N% of M today" (or "one of the first N to finish") under the win probability. If that line is missing, `DB_SERVER_SECRET` doesn't match the database: rerun step 1 and update the Vercel env var, then redeploy.

The publishable key is safe to expose (it's meant for browsers). `DB_SERVER_SECRET` must stay private.

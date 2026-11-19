# Deploying the prototype (Vercel + Supabase)

The database already lives in Supabase and needs nothing more. This covers putting the web app online.

## Before you start

- **Whose account?** For the demo, any Vercel account works. For go-live, hosting, domain and email must be registered
  in the **Government's** name (see CLAUDE.md, Handover). Do not build the Government's real system on a personal or Datagrove account.
- **Secrets.** The app needs two values: the Supabase project URL and the **service role key**. The service key has full access
  to the database. It lives only in Vercel's environment settings. Never commit it, and never put it in a `NEXT_PUBLIC_` variable.
- **No real login yet.** The prototype has a role switcher, not authentication. On a public URL, anyone could switch to
  Administrator and edit data. So always set `DEMO_ACCESS_CODE` on a deployed copy: every page then asks for the code first.
  This is a stopgap, not security: anyone with the code is effectively an administrator. Share it only with the people at the demo.

## Environment variables

| Name | Required | Where it comes from |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Yes | Supabase > Project Settings > API > Project URL |
| `SUPABASE_SERVICE_ROLE_KEY` | Yes | Supabase > Project Settings > API > secret / service_role key |
| `DEMO_ACCESS_CODE` | Yes for any public URL | You choose it. Long and random, for example three unrelated words and a number |

Not needed on Vercel: `DATABASE_URL` (only the one-off setup scripts use it) and the anon/publishable key (the app does not use it).

## Option A: Vercel dashboard (recommended)

1. Put the repo on GitHub as a **private** repository (the repo must stay private, see CLAUDE.md).
   There is no git remote yet. Create an empty private repo on GitHub, then:
   `git remote add origin <the repo URL>` and `git push -u origin main`.
2. In Vercel: **Add New > Project**, import that repo.
3. Set **Root Directory** to `apps/web`. Leave "Include source files outside of the Root Directory" switched **on**
   (the web app uses the engine in `packages/payroll-engine`).
4. Framework is detected as Next.js. Leave the build and install commands as they are.
5. Add the three environment variables above, for **Production** (and Preview if you use previews).
6. Deploy. `apps/web/vercel.json` pins the functions to Dublin (`dub1`), next to the Supabase project (eu-west-1, Ireland).

## Option B: Vercel CLI

From the repo root, logged in to the account you want:

```
vercel link            # choose or create the project; set the root directory to apps/web when asked
vercel env add NEXT_PUBLIC_SUPABASE_URL production
vercel env add SUPABASE_SERVICE_ROLE_KEY production
vercel env add DEMO_ACCESS_CODE production
vercel deploy --prod
```

`vercel env add` asks for the value on screen, so the secret never goes into the shell history or a file.

## After it is up: check it

1. Open the URL. You should see the **Demo access** page. Enter the code.
2. Dashboard: shows "Actual" figures and the two finalised October runs.
3. Walk the demo script: dashboard, Telecommunications, start a Government run for 16 Nov, review the comparison, approve as
   Administrator, finalise, open a payslip and download the PDF, switch to Employee (David Ashby) and view the portal,
   switch back and change a rate in Settings with a future date and a reason, then find it in the Audit Log, then run an Expats run.
4. If a page says "Supabase env vars are missing", a variable is not set for that environment. Add it and redeploy
   (changing variables does not change an existing deployment).

## Things to know

- **Same database as local.** A deployed copy and your laptop both write to the same Supabase project. Anything you do in the
  demo shows up everywhere. `npm run db:reset` wipes it back to the seed (and deletes everything in the project).
- **Slow link.** Pages are server-rendered and light. Every database call has a timeout and reads retry. `maxDuration` is 30 seconds.
  The first request after a quiet spell can take a few seconds (cold start).
- **After the demo:** rotate the Supabase service key (Project Settings > API) and change or remove `DEMO_ACCESS_CODE`.
- **Region and data residency.** Supabase is in Ireland and the functions run in Dublin. Whether that satisfies the Government is an
  open question (see CLAUDE.md). The Supabase region cannot be changed later without a migration.
- **Go-live checklist (full build):** Government-owned Vercel team, Supabase organisation and domain; real authentication and row-level
  security policies; remove the demo gate (`apps/web/middleware.ts`, `app/unlock`, `app/api/unlock`); real email sending in place of the stub.

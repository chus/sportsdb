# Cloudflare in front of Vercel (free tier) — runbook

**Why:** datasports.co received ~19M edge requests/month of bot traffic. Vercel Hobby's
fair-use limit is ~1M/month, so the project got paused. Blocking bots *inside*
Vercel (middleware 403/429) still counts every request. The only way to run this
traffic profile at $0 is for requests to be absorbed **before** Vercel — Cloudflare's
free plan does that: it caches HTML at its edge, challenges bots, and only forwards
cache misses to Vercel.

**Order matters — do this BEFORE requesting the one-time Vercel unblock.** The unblock
is 3× limits for 30 days, one time only. Burning it while bots still hit Vercel
directly means Pro becomes the only option.

---

## 1. Add the zone (~10 min)

1. Create a free account at cloudflare.com → **Add a site** → `datasports.co` → **Free** plan.
2. Cloudflare scans existing DNS. Make sure these two records exist and are
   **Proxied** (orange cloud):
   - `datasports.co` → `A` → `76.76.21.21` (Vercel anycast)
   - `www` → `CNAME` → `cname.vercel-dns.com`
   Delete nothing else that's there (email/TXT records etc.).
3. At your **domain registrar**, replace the nameservers with the two Cloudflare gives you.
   Propagation takes minutes to a few hours. Cloudflare emails when the zone is active.

## 2. SSL/TLS

**SSL/TLS → Overview → Full (strict).** Vercel already serves a valid certificate, so
this just works. (Not "Flexible" — that causes redirect loops with Vercel.)

## 3. Cache rules — the part that actually saves the traffic

**Caching → Cache Rules → Create rule**, in this order:

| # | Name | When incoming requests match… | Then |
|---|------|-------------------------------|------|
| 1 | Bypass API + private | `URI Path starts with /api/` OR `starts with /account` OR `/dashboard` OR `/admin` OR `/login` OR `/signup` OR `Cookie contains session_token` | **Bypass cache** |
| 2 | Cache everything else | `Hostname equals datasports.co` (all remaining requests) | **Eligible for cache** · Edge TTL: **Override origin → 1 day** · Browser TTL: Respect origin |

Rule 2 must override the origin TTL: Vercel sends `Cache-Control: max-age=0, must-revalidate`
for ISR pages (it manages freshness itself), so "respect origin" would cache nothing.
With a 1-day edge TTL on top of the site's own 1h–7d ISR TTLs, worst-case staleness
is ~2 days — acceptable for a site whose data syncs once a day.

Also enable **Caching → Tiered Cache → Smart Tiered Caching** (free): Cloudflare's
own data centers fetch from one upper-tier cache instead of each hitting Vercel.

## 4. Bot controls

- **Security → Bots → Bot Fight Mode: ON.**
- **Security → Bots → Block AI Scrapers and Crawlers: ON** (matches what
  `robots.ts`/middleware now do, but at Cloudflare's edge — costs nothing).
- **Security → WAF → Rate limiting rules** (free plan allows one):
  `All incoming requests` · requests > **50 per 10 seconds** per IP → **Block** for 10 s.

## 5. Verify (after the zone is active)

```bash
curl -sI https://datasports.co/ | grep -iE "^server:|cf-cache-status"
```

Run it twice. Expect `server: cloudflare` and, on the second run, `cf-cache-status: HIT`.
A `HIT` means that request never reached Vercel.

## 6. Bring the site back (only after steps 1–5)

1. Wait for **Sep 1** (Neon's data-transfer quota resets — the Vercel build needs the DB).
2. Submit Vercel's **one-time courtesy unblock** form.
3. In GitHub → Actions → **"Redeploy after Neon quota reset" → Run workflow**, so the
   frugal build (long ISR TTLs, robots/middleware bot rules, no compare matrix in the
   sitemap) becomes the live deployment.
4. Cloudflare → **Caching → Purge Everything** once, so the edge picks up the new build.
5. Watch Vercel → Usage for a few days. Target: well under 1M edge requests/month.
6. When comfortable, restore the schedules in `.github/workflows/vercel-crons.yml`
   and `sync-api-football.yml` (the blocks are commented at the top of each file).

## Rollback

Set the two DNS records to **DNS only** (grey cloud) or point nameservers back at the
registrar. Nothing in the app depends on Cloudflare being present.

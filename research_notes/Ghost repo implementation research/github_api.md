# GitHub API integration facts for a local-first repository tracker (as of 2026-10-31)

Method: fetched docs.github.com pages directly (WebFetch summarised each page; wording is paraphrased by that tool, so treat exact numbers as "as reported by the fetched page"). Items I could not verify are in Gaps.

## 1. Webhooks (signature, idempotency, events, timeouts, redelivery, receiving behind NAT)

### Takeaway
Validate `X-Hub-Signature-256` = `sha256=` + HMAC-SHA256 hex of the unmodified raw body, with a constant-time compare, and dedupe on `X-GitHub-Delivery`. Respond 2XX within 10 s. GitHub does not auto-retry, so a local app needs a polling reconciliation fallback. NAT'd apps can use smee.io (dev only), `gh webhook forward` (dev only), or a tunnel; the docs bless none of them for production.

### Cited Findings
- Signature header is `X-Hub-Signature-256` (the legacy `X-Hub-Signature` is HMAC-SHA1; prefer 256). Compute HMAC hex digest of the payload with the secret and SHA-256, prefix `sha256=`, compare. — [Validating webhook deliveries](https://docs.github.com/en/webhooks/using-webhooks/validating-webhook-deliveries)
- Use a constant-time comparison (e.g. Node `crypto.timingSafeEqual`), not `==`. Verify the payload exactly as received (proxies must not alter it); treat as UTF-8; validate before any other processing. — [same page](https://docs.github.com/en/webhooks/using-webhooks/validating-webhook-deliveries)
- Official test vector: secret `It's a Secret to Everybody`, payload `Hello, World!`, expected `757107ea0eb2509fc211221cce984b8a37570b6d7586c22c46f4379c8b043e17` (the header carries it with `sha256=` prefix). — [same page](https://docs.github.com/en/webhooks/using-webhooks/validating-webhook-deliveries)
- The signature header is sent only if the webhook has a secret. — [Webhook events and payloads](https://docs.github.com/en/webhooks/webhook-events-and-payloads)
- Delivery headers: `X-GitHub-Event` (event name), `X-GitHub-Delivery` (GUID), `X-Hub-Signature-256`, `X-GitHub-Hook-ID`, `X-GitHub-Hook-Installation-Target-Type`, `X-GitHub-Hook-Installation-Target-ID`. Payloads are capped at 25 MB; larger events are not delivered. — [Webhook events and payloads](https://docs.github.com/en/webhooks/webhook-events-and-payloads)
- Respond 2XX within 10 seconds; otherwise GitHub closes the connection and records the delivery as failed. Acknowledge immediately, process async. — [Best practices for using webhooks](https://docs.github.com/en/webhooks/using-webhooks/best-practices-for-using-webhooks)
- Use `X-GitHub-Delivery` to distinguish deliveries / detect replay; a redelivery keeps the same header value as the original, so it works as an idempotency key. — [Best practices](https://docs.github.com/en/webhooks/using-webhooks/best-practices-for-using-webhooks)
- Optional IP allow-listing via `GET /meta` (`hooks` field); changelog 2026-10-29 added three ranges (9.234.98.160/28, 9.234.98.176/28, 9.234.106.48/28) for github.com. Only matters if the receiver is publicly reachable. — [Best practices](https://docs.github.com/en/webhooks/using-webhooks/best-practices-for-using-webhooks); [Changelog 2026-10-29](https://github.blog/changelog/2026-10-29-webhook-ip-ranges-added-to-the-meta-api/)
- GitHub does NOT automatically redeliver failed deliveries. Failed = `status` other than `OK` (server down, or >10 s). Manual redelivery and "list deliveries" exist via API for repository, organization, and GitHub App webhooks (not Marketplace/Sponsors). — [Handling failed webhook deliveries](https://docs.github.com/en/webhooks/using-webhooks/handling-failed-webhook-deliveries)
- Event payloads (from the events reference):
  - `push`: no `action`; fields `ref`, `before`, `after`, `commits` (max 2048), `head_commit` (object|null), `compare`, `created`, `deleted`, `forced`, `base_ref`, `pusher`. — [Webhook events](https://docs.github.com/en/webhooks/webhook-events-and-payloads)
  - `pull_request`: actions `assigned, auto_merge_disabled, auto_merge_enabled, closed, converted_to_draft, demilestoned, dequeued, edited, enqueued, labeled, locked, milestoned, opened, ready_for_review, reopened, review_request_removed, review_requested, stacked, synchronize, unassigned, unlabeled, unlocked`; always `pull_request` object, `number`; `synchronize` has `before`/`after`. Merge is `closed` with `pull_request.merged == true` (merged flag is standard payload content; not separately confirmed on the fetched page). — [Webhook events](https://docs.github.com/en/webhooks/webhook-events-and-payloads)
  - `issues`: actions include `opened, closed, reopened, edited, deleted, transferred, labeled, unlabeled, assigned, unassigned, milestoned, demilestoned, locked, unlocked, pinned, unpinned, typed, untyped, field_added, field_removed`; always `issue`. — [Webhook events](https://docs.github.com/en/webhooks/webhook-events-and-payloads)
  - `release`: actions `created, deleted, edited, prereleased, published, released, unpublished`; always `release`. — [Webhook events](https://docs.github.com/en/webhooks/webhook-events-and-payloads)
  - `create` / `delete`: no `action`; fields `ref`, `ref_type` (branch/tag), `pusher_type` (create also `master_branch`, `description`). — [Webhook events](https://docs.github.com/en/webhooks/webhook-events-and-payloads)
  - `repository`: actions `archived, created, deleted, edited, privatized, publicized, renamed, transferred, unarchived`; `changes` on edited/renamed/transferred. — [Webhook events](https://docs.github.com/en/webhooks/webhook-events-and-payloads)
  - `installation`: actions `created, deleted, new_permissions_accepted, suspend, unsuspend`; `repositories`, `requester`. `installation_repositories`: actions `added, removed`; `repositories_added`, `repositories_removed`, `repository_selection`. — [Webhook events](https://docs.github.com/en/webhooks/webhook-events-and-payloads)
- Available subscribable events depend on the permissions granted to the App (e.g. Issues permission needed to subscribe to issues events). — [Using webhooks with GitHub Apps](https://docs.github.com/en/apps/creating-github-apps/registering-a-github-app/using-webhooks-with-github-apps)
- Local receiving: smee.io gives a proxy URL; run `smee --url <proxy> --path /webhook --port 3000` (npm `smee-client`). Docs explicitly say "Never use Smee for an application in production." — [Testing webhooks](https://docs.github.com/en/webhooks/testing-and-troubleshooting-webhooks/testing-webhooks); [Using webhooks with GitHub Apps](https://docs.github.com/en/apps/creating-github-apps/registering-a-github-app/using-webhooks-with-github-apps)
- `gh webhook forward --repo=OWNER/REPO --events=issues,pull_request --url=http://localhost:3000/webhook` (extension `cli/gh-webhook`): works for repository and organization webhooks only, dev/testing only, one forwarder per repo/org at a time ("Hook already exists"). Org needs `admin:org_hook` scope. — [Using the GitHub CLI to forward webhooks](https://docs.github.com/en/webhooks/testing-and-troubleshooting-webhooks/using-the-github-cli-to-forward-webhooks-for-testing) (via search snippet; page not fetched in full)

### Inferences
- A smee/`gh webhook forward`/tunnel (ngrok, cloudflared etc.) path is fine for a self-hosted local tool but is best-effort: since there is no auto-retry and GitHub only keeps recent delivery history, the app must also run a periodic poll (ETag-conditional) to catch missed events when the machine was asleep.
- Dedup store: a small JSON file/ring buffer of recent `X-GitHub-Delivery` GUIDs is sufficient.
- In Next.js 14 route handlers read `await req.text()` (not `req.json()`) before verifying, so the raw bytes are HMACed.
- Because webhooks need a public URL, make webhook support optional and polling the default.

### Gaps
- Redelivery time window (I recall ~3 days of delivery history) was not on the fetched page; unverified.
- No primary source found on smee.io reliability/retention or on tunnel services (ngrok, cloudflared); the GitHub docs cover only smee and `gh webhook forward`.
- Whether `installation` / `installation_repositories` are delivered without explicit subscription for App webhooks: not stated on fetched pages; unverified.

## 2. Conditional requests, ETag, Events API polling

### Takeaway
Send `If-None-Match` (ETag) or `If-Modified-Since` (Last-Modified); a 304 does not count against the primary limit provided the request is authenticated. Events endpoints are designed for ETag polling and return `X-Poll-Interval`, but have hours of latency and a 300-event/30-day window.

### Cited Findings
- Store `etag`/`last-modified` and send as `if-none-match`/`if-modified-since`; a 304 does not count toward the primary rate limit only if the request has an `Authorization` header. — [Best practices for the REST API](https://docs.github.com/en/rest/using-the-rest-api/best-practices-for-using-the-rest-api)
- ETag is opaque; any change in parameters, page, or filter yields a different ETag, so reuse identical params each poll and a stable sort (`sort=updated` can shift items across pages). — [same page](https://docs.github.com/en/rest/using-the-rest-api/best-practices-for-using-the-rest-api)
- If polling, poll on a fixed schedule and wait at least `x-poll-interval` seconds if the header is present. Webhooks preferred. — [same page](https://docs.github.com/en/rest/using-the-rest-api/best-practices-for-using-the-rest-api)
- Events API: optimized for ETag polling; 304 does not consume rate limit; ETag must be sent quoted in `If-None-Match`. `X-Poll-Interval` is the minimum seconds between polls (example 60), may increase under load; "please obey". Timeline holds up to 300 events, only from the past 30 days. Not for real-time: latency "30s to 6h". `per_page` max 100 (default 15 for `GET /events`, 30 for the others). — [Events API](https://docs.github.com/en/rest/activity/events)
- Repository events endpoint: `GET /repos/{owner}/{repo}/events`. — [Events API](https://docs.github.com/en/rest/activity/events#list-repository-events)
- Pagination: follow the `Link` header (`rel="next"`, `rel="last"`; last may be omitted); `per_page` over max is silently clamped. — [Using pagination](https://docs.github.com/en/rest/using-the-rest-api/using-pagination-in-the-rest-api)

### Inferences
- Per-repo, per-endpoint ETag persistence in the JSON store (keyed by full URL including query) makes steady-state polling nearly free for the primary limit. ETags apply per page, so only conditional-check page 1 and walk further pages only when it changes (inference).
- Prefer a `since`-based incremental fetch of commits/issues combined with conditional requests on page 1.

### Gaps
- No primary-source statement listing exactly which REST endpoints support ETag; the docs say it generally applies to GETs with `etag` headers. Stats endpoints and GraphQL (POST) ETag behavior: not stated (GraphQL page does not mention ETag).
- Whether a 304 from the Events API for GitHub App installation tokens behaves identically: not separately documented in what I read.

## 3. Rate limits

### Takeaway
PAT: 5,000 req/h. App installation: 5,000 baseline, +50/h per repo and per org user beyond 20, capped at 12,500 (15,000 on Enterprise Cloud orgs). Secondary limits: 100 concurrent, 900 points/min REST, 2,000 points/min GraphQL. Run requests serially and honor `retry-after` / `x-ratelimit-reset`.

### Cited Findings
- Unauthenticated 60/h per IP; authenticated user (PAT) 5,000/h; apps/OAuth apps acting for a user count against that user's 5,000. — [Rate limits for the REST API](https://docs.github.com/en/rest/using-the-rest-api/rate-limits-for-the-rest-api)
- GitHub App installation token: 5,000/h minimum; 15,000 for installations on a GitHub Enterprise Cloud org; otherwise +50/h per repo beyond 20 and +50/h per org user beyond 20, max 12,500. `GITHUB_TOKEN` in Actions 1,000/h/repo. — [same page](https://docs.github.com/en/rest/using-the-rest-api/rate-limits-for-the-rest-api)
- Response headers: `x-ratelimit-limit`, `-remaining`, `-used`, `-reset` (UTC epoch seconds), `-resource`. Headers are authoritative over `GET /rate_limit`; values can vary by region. — [same page](https://docs.github.com/en/rest/using-the-rest-api/rate-limits-for-the-rest-api)
- Secondary limits: max 100 concurrent requests (REST+GraphQL), 900 points/min REST, 2,000 points/min GraphQL, 90 s CPU per 60 s real time (<=60 s GraphQL), ~80 content-creating requests/min and 500/h, OAuth token requests 2,000/h. Points: GET/HEAD/OPTIONS 1, POST/PATCH/PUT/DELETE 5; GraphQL query 1, mutation 5. — [same page](https://docs.github.com/en/rest/using-the-rest-api/rate-limits-for-the-rest-api)
- Retry: primary exceeded -> 403/429 with remaining 0: wait until `x-ratelimit-reset`. Secondary: if `retry-after` present wait that many seconds; else if remaining 0 wait until reset; else wait >= 1 minute; then exponential backoff with a cap on retries. Continuing while limited can get the integration banned. Make requests serially via a queue; >=1 s between mutating requests. — [Rate limits](https://docs.github.com/en/rest/using-the-rest-api/rate-limits-for-the-rest-api); [Best practices](https://docs.github.com/en/rest/using-the-rest-api/best-practices-for-using-the-rest-api)
- Changelog: `code_scanning_upload` field removed from `/rate_limit` on 2026-05-19 (shares core pool); semantic issue search limited to 10 req/min (April 2026). — [Changelog 2026-05-19](https://github.blog/changelog/2026-05-19-removal-of-code_scanning_upload-field-from-rate_limit-api-endpoint/); [Changelog 2026-04-02](https://github.blog/changelog/2026-04-02-improved-search-for-github-issues-is-now-generally-available/) (from search snippets)
- REST API versioning: latest `2026-03-10`; default when header omitted is `2022-11-28` (supported until 2028-03-10); send `X-GitHub-Api-Version`. — [API versions](https://docs.github.com/en/rest/about-the-rest-api/api-versions)

### Inferences
- A tracker for ~dozens of repos on 5,000/h with ETag polling every few minutes stays far under budget; a single serial worker is also the simplest way to respect secondary limits.

### Gaps
- Exact Enterprise-Cloud-only numbers beyond what is cited not explored.

## 4. GitHub App vs fine-grained PAT vs OAuth App

### Takeaway
GitHub recommends GitHub Apps for long-lived integrations; PATs (fine-grained) are for scripts and testing. For a self-hosted local tool, the simplest safe path is a fine-grained PAT (read-only) as default, with an optional GitHub App for webhooks and scaling limits.

### Cited Findings
- Comparison: App acts as itself or for a user, fine-grained permissions incl. read-only, repos chosen at install, short-lived tokens, rate limits scale, doesn't use a seat, centralized webhooks. OAuth app: broad scopes (e.g. `repo`), tokens don't expire until revoked, lower non-scaling limits, tied to user. PAT: tied to a user; fine-grained recommended over classic; suited to testing and short-lived scripts. GitHub recommends Apps for long-lived integrations, generally over OAuth apps. — [Deciding when to build a GitHub App](https://docs.github.com/en/apps/creating-github-apps/about-creating-github-apps/deciding-when-to-build-a-github-app)
- Installation flow: sign JWT (RS256; claims `iat` backdated 60 s, `exp` <= 10 minutes ahead, `iss` = client ID recommended or app ID), then `POST /app/installations/{id}/access_tokens` with `Authorization: Bearer <JWT>`; token expires after 1 hour; optional `repositories`/`repository_ids` (up to 500) narrow scope. — [Generating a JWT](https://docs.github.com/en/apps/creating-github-apps/authenticating-with-a-github-app/generating-a-json-web-token-jwt-for-a-github-app); [Generating an installation access token](https://docs.github.com/en/apps/creating-github-apps/authenticating-with-a-github-app/generating-an-installation-access-token-for-a-github-app)
- Device flow is available for GitHub Apps but must be enabled in app settings (else `device_flow_disabled`). `POST https://github.com/login/device/code` (client_id) -> `device_code`, `user_code`, `verification_uri`, `expires_in` 900, `interval` 5; user enters code at `https://github.com/login/device`; poll `POST https://github.com/login/oauth/access_token` with `grant_type=urn:ietf:params:oauth:grant-type:device_code`; errors `authorization_pending`, `slow_down` (+5 s), `expired_token`, `access_denied`. User token (`ghu_`) 8 h, refresh token (`ghr_`) 6 months when expiring tokens enabled. — [Generating a user access token](https://docs.github.com/en/apps/creating-github-apps/authenticating-with-a-github-app/generating-a-user-access-token-for-a-github-app)
- Device-flow user tokens made via an App count against the user's 5,000/h limit (apps acting on a user's behalf share that budget). — [Rate limits](https://docs.github.com/en/rest/using-the-rest-api/rate-limits-for-the-rest-api)
- Best practices: store private key securely (key vault, sign-only preferred; env var weaker), never ship it in client/native apps, cache installation tokens, minimal permissions, set a webhook secret, prefer webhooks and GraphQL consolidation over polling many REST calls. — [Best practices for creating a GitHub App](https://docs.github.com/en/apps/creating-github-apps/about-creating-github-apps/best-practices-for-creating-a-github-app)
- Permissions per endpoint (read level): `GET /repos/{o}/{r}/commits` -> Contents; `/pulls` -> Pull requests; `/issues` -> Issues; `/releases` -> Contents; `/stats/commit_activity|contributors|participation` -> Metadata. The fetched page did not state that Metadata is mandatory (it is widely known as default read-only; not confirmed here). — [Permissions required for GitHub Apps](https://docs.github.com/en/rest/authentication/permissions-required-for-github-apps)

### Inferences
- For local-first: (a) Fine-grained PAT, read-only (Metadata, Contents, Issues, Pull requests) = zero infra, but user-bound and expires; polling only. (b) GitHub App with device flow = no server-side client secret needed and a per-user login, but the user token still shares the 5,000/h pool; (c) App installation token = needs private key stored locally (the user would register their own App; the key lives on their machine) plus a webhook URL; best limits and webhooks. OAuth App is least attractive per the docs.
- A single App webhook is configured once (vs per-repo hooks), which suits "track many repos".

### Gaps
- Fine-grained PAT specifics (expiry limits, org approval policies, public-repo-only access, which endpoints unsupported) not fetched.
- Whether a device-flow-only App can call webhooks-delivery list endpoints: not checked.

## 5. Endpoints, pagination, stats, GraphQL

### Takeaway
All list endpoints are `per_page` <= 100 with `Link` header pagination. Issues endpoint includes PRs (filter on `pull_request` key). Stats endpoints return 202 while computing and must be retried. GraphQL can batch many repos but has its own point/node limits.

### Cited Findings
- List commits `GET /repos/{o}/{r}/commits`: `sha`, `path`, `author`, `since`, `until` (ISO 8601 `YYYY-MM-DDTHH:MM:SSZ`, valid range 1970-2099), `per_page` (max 100, default 30), `page`. — [Commits](https://docs.github.com/en/rest/commits/commits#list-commits)
- List PRs `GET /repos/{o}/{r}/pulls`: `state` (open|closed|all, default open), `head` (`user:ref`), `base`, `sort` (created|updated|popularity|long-running), `direction`, `per_page` max 100. No `since` param. — [Pulls](https://docs.github.com/en/rest/pulls/pulls#list-pull-requests)
- List issues `GET /repos/{o}/{r}/issues`: `state`, `since` (updated after), `sort` (created|updated|comments), `direction`, `per_page` max 100. PRs are returned too; detect via `pull_request` key; an item's `id` is the issue ID. — [Issues](https://docs.github.com/en/rest/issues/issues#list-repository-issues)
- List releases `GET /repos/{o}/{r}/releases`: `per_page` max 100, `page`; drafts visible only to users with push access; list sort order not stated on the page. — [Releases](https://docs.github.com/en/rest/releases/releases#list-releases)
- Stats: cached by default-branch SHA (push to default branch resets cache). If not cached the endpoint returns 202 and starts a background job; wait and re-request for 200. `commit_activity`: last year by week, items `{days[7] (Sunday first), total, week}`. `participation`: last 52 weeks, `all` and `owner` arrays, index 0 oldest (subtract owner from all for others). `contributors`: per-contributor `total` and `weeks[{w,a,d,c}]`. `code_frequency` returns 422 for repos with >=10,000 commits; `contributors` returns 0 additions/deletions for >=10,000 commits. Stats exclude merge commits (contributors also exclude empty commits). — [Repository statistics](https://docs.github.com/en/rest/metrics/statistics)
- GraphQL: 5,000 points/h per user (10,000 for apps owned by GHEC orgs); cost = (requests needed to fill all connections)/100, min 1; max 500,000 nodes per call; every connection needs `first`/`last` in 1..100; `rateLimit { cost remaining resetAt }` available; secondary limit 2,000 points/min. — [GraphQL rate limits](https://docs.github.com/en/graphql/overview/rate-limits-and-query-limits-for-the-graphql-api)

### Inferences
- Batch many repos in one GraphQL query using aliases (`r1: repository(owner:..,name:..) {...}`) to fetch latest commit/PR/issue/release summaries cheaply; use REST + ETag for deltas. Aliased-repository batching is standard GraphQL but I did not locate a GitHub doc page demonstrating it.
- Stats 202 handling: retry with short backoff (e.g. 1-3 attempts, a few seconds apart), then give up and try next poll cycle; do not hammer.
- For incremental issue sync use `since` + `sort=updated&direction=asc`; for PRs sort by `updated` desc and stop at the last-seen timestamp (no `since`).

### Gaps
- Exact 202 retry guidance (delay/attempt count) is not given beyond "wait a short time".
- Whether 304s work for stats endpoints: not documented in what I read.
- GraphQL examples for multi-repo batching and fields like `defaultBranchRef.target.history(since:)` not fetched.

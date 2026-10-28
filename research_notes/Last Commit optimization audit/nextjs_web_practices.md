# Web-layer best practices for Next.js 14 (App Router) + React 18 + Tailwind 3 + zod (as of 2026-10-28)

## 1. Should the project upgrade Next 14 to 15/16? (versions, costs, benefits)

### Takeaway
Yes. Next 14 is unsupported and gets no security patches, while 16.x is Active LTS (latest seen: 16.4, React 19.3). Migration is mostly mechanical (async request APIs, React 19, lint/middleware renames), and the route-handler caching trap in Next 14 goes away.

### Cited Findings
- Support policy: 16.x is Active LTS (released Oct 21, 2025). 15.x is Maintenance LTS (critical fixes only; the original Oct 21, 2026 end date "has been extended", with a new date to be announced). 14.x is "Unsupported". — [Next.js support policy](https://nextjs.org/support-policy)
- The latest Next.js release is 16.4 (2026-10-06): lazy compilation, smaller Turbopack output, React 19.3, Cache Components improvements. From 16.4, Cache Components is recommended for every app and becomes the default in Next 17. — [Next.js 16.4](https://nextjs.org/blog/next-16-4.md)
- The Oct 14, 2026 out-of-band security update shipped only in v16.4.1 (Active LTS) and v15.5.28 (Maintenance LTS), not 14.x. It fixes unauthenticated RCE in `use cache` functions, RCE in the Image Optimization API with SVG on glibc Linux (workaround: sharp >= 0.35.5), and a Server Actions DoS (High). — [Oct 14, 2026 security update](https://nextjs.org/blog/nextjs-security-update-october-14-2026.md)
- Next.js has moved to a formal monthly security-release process (July, Aug, Sep 2026 releases). Another scheduled release is planned for Nov 3, 2026. — [Next.js blog index](https://nextjs.org/blog)
- Earlier React Server Components protocol vulns (CVE-2025-66478, Dec 2025) required upgrading to patched versions. — [Next.js blog index](https://nextjs.org/blog)
- Third-party EOL trackers say 14.x EOL was Oct 26, 2025 with a final 14.2.35 patch on Dec 11, 2025. The official policy page says only "Unsupported", and the trackers disagree on 15's status. — [HeroDevs EOL page](https://www.herodevs.com/blog-posts/nextjs-eol-dates-version-support-timeline)
- Upgrade requirements for 16: Node.js >= 20.9.0 (Node 18 dropped), TypeScript >= 5.1, and Chrome/Edge/Firefox 111+ and Safari 16.4+. — [Upgrade to v16 guide](https://nextjs.org/docs/app/guides/upgrading/version-16)
- Breaking changes in 16:
  - Sync access to `params`, `searchParams`, `cookies()` and `headers()` is fully removed (including `params` in `route.js`).
  - `next lint` is removed.
  - `middleware` is renamed to `proxy`.
  - Turbopack is the default for dev and build, and a custom `webpack` config makes `next build` fail unless you pass `--webpack`.
  - `serverRuntimeConfig` and `publicRuntimeConfig` are removed.
  - Parallel-route slots need `default.js`.
  — [Upgrade to v16 guide](https://nextjs.org/docs/app/guides/upgrading/version-16)
- Tooling for the migration: `npx @next/codemod@canary upgrade latest`, the async-request-API codemod `npx @next/codemod@canary next-async-request-api .`, `npx next typegen` (global `RouteContext` type for route handlers), and an agent-assisted `npx next@canary upgrade --agent=latest`. — [Upgrade to v16 guide](https://nextjs.org/docs/app/guides/upgrading/version-16)
- React Compiler support is stable in 16 (`reactCompiler: true`, needs `babel-plugin-react-compiler`, off by default, slower builds). It auto-memoizes components. — [Upgrade to v16 guide](https://nextjs.org/docs/app/guides/upgrading/version-16)
- Next 16 uses React 19.2 (App Router uses a React canary), and 16.4 ships React 19.3. — [Upgrade to v16 guide](https://nextjs.org/docs/app/guides/upgrading/version-16); [Next.js 16.4](https://nextjs.org/blog/next-16-4.md)
- Do not enable `cacheComponents` just to finish the upgrade. It is not a rename-only change and can surface build errors. The checklist says React Compiler and Cache Components should not be enabled merely to complete the upgrade. — [Upgrade to v16 guide](https://nextjs.org/docs/app/guides/upgrading/version-16)
- Next 15.5 deprecated `next lint` and added deprecation warnings for 16, so 14 to 15.5 to 16 is a possible stepping path. — [Next.js blog index](https://nextjs.org/blog)
- Zod 4 is stable (`npm i zod@^4`). It is about 14.7x faster for string parsing, 6.5x for object safeParse, and 5.36kb gzipped core vs 12.47kb. It has a single `error` param, `z.prettifyError`, `z.toJSONSchema()` and top-level `z.email()`. `zod/v3` stays available. — [Zod 4 release notes](https://zod.dev/v4)

### Inferences
- Tailwind 3 and React 18 are independent of the Next 16 move, except that React must go to 19.x. Check that third-party UI libs support React 19 (not researched).
- For a hackathon-scale app with simple route handlers and no middleware, no PPR, no custom webpack and few dynamic routes, the migration is likely small (async `params` in `[id]` routes plus lint config). The cost estimate is mine, not sourced.
- The security argument is the strongest: staying on 14.x means no fixes for the continuing monthly advisories, which matters if the tool scans user-supplied repos or runs on a public host.
- Recommended path: go straight to 16.4.x (Node >= 20.9, ideally 22 or 24) and skip Cache Components for now. Zod 4 can be adopted separately.

### Gaps
- No exact "latest 16.4.x patch" was verified beyond 16.4.1, which the Oct 14 post names.
- Whether Tailwind 3 works unchanged with Turbopack in 16 was not checked (it generally uses PostCSS). Tailwind 4 was not researched.
- No new 15.x end date has been announced on the policy page.

## 2. Route handler best practices (zod validation, streaming, runtime/dynamic, caching, errors)

### Takeaway
In Next 15+ `GET` handlers are uncached by default (Next 14 cached them unless they read the request), so a Next 14 scan endpoint may be silently static today. Validate every input with zod `safeParse`, pin `runtime = 'nodejs'` for fs and native modules, and stream long work with a `ReadableStream` returned immediately, wired to `request.signal`.

### Cited Findings
- Next 14 cached `GET` Route Handlers by default unless they used a dynamic function or dynamic config. Next 15 changed the default to uncached, and you opt in with e.g. `export const dynamic = 'force-static'`. — [Next.js 15 announcement](https://nextjs.org/blog/next-15); [Next 14 route handlers docs](https://nextjs.org/docs/14/app/building-your-application/routing/route-handlers.md)
- Route handlers use the standard Web Request/Response API. `NextRequest` adds `nextUrl.searchParams`, and `context.params` is a Promise in 15+. Bodies are read with `request.json()` or `request.formData()` and need no bodyParser. The docs suggest `zod-form-data` to validate FormData. — [route.js reference](https://nextjs.org/docs/app/api-reference/file-conventions/route)
- Segment config for handlers: `runtime` defaults to `'nodejs'` (`'edge'` is deprecated), `maxDuration` is set by the deployment platform, and `preferredRegion` is deprecated. In 16, `dynamic`, `dynamicParams`, `revalidate` and `fetchCache` are removed only when Cache Components is enabled. — [Route Segment Config](https://nextjs.org/docs/app/api-reference/file-conventions/route-segment-config)
- Native or Node-specific packages are opted out of bundling via `serverExternalPackages`. `better-sqlite3`, `sqlite3`, `ts-morph`, `typescript`, `shiki`, `pino`, `sharp`, `prisma` and `pg` are already on the auto-opt-out list (stable since 15.0). This matters for the project's AST analysis using TypeScript or ts-morph. — [serverExternalPackages](https://nextjs.org/docs/app/api-reference/config/next-config-js/serverExternalPackages)
- Streaming pattern from the docs: build a `ReadableStream` with `pull`/`controller.enqueue`, then `return new Response(stream)`. — [route.js reference](https://nextjs.org/docs/app/api-reference/file-conventions/route)
- Practitioner reports (secondary, not official):
  - If the handler awaits the whole loop before returning the Response, output is buffered until it finishes. Return the Response first and run the work in the background.
  - Common SSE headers are `Content-Type: text/event-stream`, `Cache-Control: no-cache, no-transform`, `Connection: keep-alive` and `X-Accel-Buffering: no` (for nginx and proxies).
  - Listen to `request.signal` `abort` to clear heartbeats and close the controller, but abort detection has been reported unreliable on Vercel.
  — [SSE in Next.js (DEV)](https://dev.to/richardlau/implementing-real-time-status-updates-with-server-sent-events-in-nextjs-4da1); [Fixing slow SSE (Medium)](https://medium.com/@oyetoketoby80/fixing-slow-sse-server-sent-events-streaming-in-next-js-and-vercel-99f42fbdb996); [Vercel community thread](https://community.vercel.com/t/request-abortion-while-streaming-response-on-vercel/6071)
- Treat `route.ts` and `proxy.ts` as high-power entry points to audit like any traditional endpoint. Params in bracketed folders are user input. Validate Server Action arguments, re-check authorization in each action, return minimal DTOs, and rate-limit expensive operations. — [Data security guide](https://nextjs.org/docs/app/guides/data-security)
- zod 4 `z.prettifyError` and the single `error` option simplify 400 responses. `z.toJSONSchema()` can generate API docs or JSON Schema from the same schemas. — [Zod 4](https://zod.dev/v4)

### Inferences
- Suggested handler shape (not a direct quote from any source):
  - `export const runtime = 'nodejs'` and `export const dynamic = 'force-dynamic'` (valid in 14 and 15; remove when adopting Cache Components).
  - `schema.safeParse(await req.json().catch(() => null))`, returning 400 with flattened errors.
  - Map known errors to 4xx and avoid leaking absolute paths or stack traces to clients.
  - Use `request.signal` to stop a long scan.
- For progress on long scans, SSE via `ReadableStream` is the lightest option (no WebSocket server needed). Emit a heartbeat comment every 15-30 s, and send a final `done` or `error` event so the client can distinguish a clean end from a dropped connection.
- The long-scan endpoint should be a job (POST starts a job and returns an id; GET streams or polls) if runs outlive typical serverless limits. If deployed on Vercel, `maxDuration` and plan limits apply (not verified here).
- Since Next 14 cached `GET`s by default, an existing `GET /api/...` that does not read `request` or `searchParams` may return stale data in production builds. Audit those first.

### Gaps
- No official Next.js doc on SSE specifics was found. Recommendations rest on community posts.
- Body size limits for route handlers were not researched, so set manual limits for uploads (see section 5).
- Details on `maxDuration` behavior when self-hosting were not checked.

## 3. File-based persistence pitfalls and lightweight alternatives

### Takeaway
Writing JSON in place can corrupt data on crash or concurrent requests. Write to a temp file in the same directory, fsync, and rename (as `write-file-atomic` does), and add a cross-process lock if more than one process writes. For anything beyond a single small file, SQLite in WAL mode is the standard lightweight upgrade, and `better-sqlite3` is already on Next's auto-externalized list.

### Cited Findings
- The standard atomic-write pattern is: write a temp file in the same directory, fsync it, rename it over the target, and clean up on error. Direct writes can corrupt the file if the process crashes or multiple processes touch it. Rename semantics differ on Windows. — [oauth-callback issue discussing the pattern](https://github.com/kriasoft/oauth-callback/issues/4)
- `write-file-atomic` implements this (temp name from target plus hash of PID and invocation counter, then rename, unlink on error, `fsync` default true). Its latest version per one scanner is 6.0.0. It queues concurrent writes to the same path only inside one process, which is my reading of a third-party write-up. — [write-file-atomic README mirror](https://chromium.googlesource.com/devtools/devtools-frontend/+show/0611f278abe052d949540e84bd85395ea792823a/node_modules/write-file-atomic/README.md); [meterian listing](https://meterian.io/components/nodejs/write-file-atomic)
- `better-sqlite3`: the README says WAL mode is generally important for performance, and poor performance is mostly from inefficient queries, bad indexes or missing WAL. — [better-sqlite3 README](https://app.unpkg.com/better-sqlite3@11.10.0/files/README.md)
- `better-sqlite3` is on Next's default `serverExternalPackages` list, so it works in route handlers without extra config. — [serverExternalPackages](https://nextjs.org/docs/app/api-reference/config/next-config-js/serverExternalPackages)
- `node:sqlite` is built in (added v22.5.0), no flag needed since v22.13/23.4, and is "Stability 1.2 Release candidate" since v25.7.0. — [Node.js sqlite docs](https://nodejs.org/api/sqlite.html)
- A third-party benchmark compares better-sqlite3, node:sqlite, libSQL and Turso on Node v25.3.0 with WAL. The results table was not retrieved. — [sqg.dev benchmark via HN reader](https://hn.jakechampion.name/reader/https://sqg.dev/blog/sqlite-driver-benchmark)
- Next 16 adds a lockfile mechanism for `next dev` and `next build`. Dev now writes to `.next/dev`. — [Upgrade to v16 guide](https://nextjs.org/docs/app/guides/upgrading/version-16)

### Inferences
- Pitfalls to check in the JSON layer:
  - Read-modify-write races between concurrent requests (lost updates).
  - Torn or partial reads while a write is in progress.
  - In-place `writeFile` truncating on a crash.
  - Hot reload (dev) re-running module state, so module-level caches go stale.
  - Writing inside `.next` or other ephemeral or read-only filesystems on serverless hosts.
- Cheapest fix: a single in-process async mutex per file plus atomic write-and-rename. Add `proper-lockfile` only for multi-process cases (not sourced here).
- Better fix: `better-sqlite3` (or `node:sqlite` if Node >= 22.13 and the RC status is acceptable) with `PRAGMA journal_mode = WAL`, a prepared-statement layer, and zod validation at the boundary. Store flexible blobs (scan results) as JSON text columns. This is a small change for a hackathon codebase.
- Native modules need a build toolchain or prebuilt binaries on the host, and do not work on serverless hosts with read-only disk. This is an inference.

### Gaps
- `proper-lockfile` behavior was not verified. No source was found.
- No verified benchmark numbers for better-sqlite3 vs node:sqlite.
- No source on SQLite on Vercel or other serverless (ephemeral disk) was gathered.

## 4. React performance for large diffs and file trees

### Takeaway
Virtualize long lists (TanStack Virtual v3 is the current headless option), compute diffs with `jsdiff` using `timeout` or `maxEditLength` (and `structuredPatch` for hunks) so huge files do not hang, and keep heavy viewers as lazily imported Client Components. The React Compiler can replace most manual `memo`.

### Cited Findings
- TanStack Virtual is a headless virtualization library. The React adapter is v3 (latest), it supports dynamic row heights by estimating then measuring, and it supports window, grid and lanes scrolling. Its page reports about 43.7M weekly downloads. — [TanStack Virtual](https://tanstack.com/virtual/latest)
- jsdiff (`diff` package): `diffLines`, `diffWords` and `structuredPatch` (returns hunks with a `context` option). The `timeout` (ms) and `maxEditLength` options make a diff return `undefined` when the limit is hit. A `callback` runs the diff asynchronously to avoid blocking the event loop. Types are bundled since v8, and v9+ targets the latest Node LTS and Baseline browsers. — [jsdiff README](https://github.com/kpdecker/jsdiff)
- Next 16 includes stable React Compiler support (`reactCompiler: true`) that auto-memoizes components and reduces re-renders without code changes, at the cost of slower compiles (Babel). The Rust version is experimental in 16.3 and 16.4. — [Upgrade to v16 guide](https://nextjs.org/docs/app/guides/upgrading/version-16); [Next.js 16.4](https://nextjs.org/blog/next-16-4.md)
- Next 16.4 adds an experimental `turbopackLazyDynamicImports` for compiling client-side `import()` code only when requested. It is relevant to lazily loading a diff viewer. — [Next.js 16.4](https://nextjs.org/blog/next-16-4.md)
- Client code must not import Node-native modules (`fs`) or you get "Can't resolve 'fs'". Refactor so client bundles never reference them, rather than aliasing to an empty module. — [Upgrade to v16 guide](https://nextjs.org/docs/app/guides/upgrading/version-16)
- Server Components can read secrets and databases, but Client Components must follow browser security assumptions. Pass minimal DTOs, and use `server-only` to fail the build if server code is imported by client code. — [Data security guide](https://nextjs.org/docs/app/guides/data-security)

### Inferences
- Diff viewer: compute diffs on the server (route handler or Server Component) or in a Web Worker, send hunks rather than full files, and render only visible hunk rows via virtualization. For split view, keep both columns in one virtualized row list so scroll stays synchronized. Collapse unchanged regions beyond a context window. Fall back to a "file too large to diff" message when `timeout` triggers.
- Avoid a line-by-line `diffWords` highlight pass on every line of a large diff. Run it only for changed line pairs within visible rows.
- File tree: flatten the tree to an array of visible nodes (depth plus expanded set), then virtualize that array. Make nodes `React.memo` with stable callbacks (or rely on the React Compiler), and lazy-load children for large directories from the API.
- Keep the page and layout as Server Components and make only the interactive explorer and diff panes `'use client'`. Use `next/dynamic` (with `ssr: false` if it depends on browser APIs) for the heavy diff viewer so it is not in the initial bundle.
- Tailwind 3 note: avoid generating dynamic class names via string concatenation in virtualized rows, since Tailwind scans for complete class strings. (General Tailwind knowledge, not researched here.)

### Gaps
- No official react.dev source on `memo`/`useMemo`, `useDeferredValue` or transitions for large lists was fetched in this pass, so those are not cited.
- `@tanstack/react-virtual` API details and compatibility with the React Compiler were not retrieved. `react-window` was not researched, and no 2026 comparison was found.
- No measured thresholds (for example at what line counts a diff needs virtualization).

## 5. Security: path traversal, safe zip and clone handling, secrets in settings routes

### Takeaway
Never trust a client-supplied path: resolve it, canonicalize with `realpath`, and verify it stays inside an allowed root before any read. Treat archives as hostile (entry-path checks and decompressed size and file-count limits), and keep API keys server-only, never returned to the client in full.

### Cited Findings
- In Node, `path.join()` does not stop `..` traversal (joining `/uploads` with `../../../etc/passwd` yields `/etc/passwd`) and `path.resolve()` alone does not confine to a base directory. The mitigation is to check that the resolved path stays inside the base directory. — [Node.js path traversal guide (fooqux)](https://fooqux.com/article/2475); [Zip Slip in Node (Medium)](https://medium.com/intrinsic/protecting-node-js-applications-from-zip-slip-b24a37811c10)
- Zip Slip is path traversal during archive extraction (`../` entries write outside the target). Different APIs of the same library can parse a crafted archive differently (unzipper `Open.file` vs `Extract`), so validate every entry the extractor actually processes. `unzipper` had CVE-2018-1002203, fixed in 0.8.13. A Snyk entry lists directory traversal in `zip-lib` < 1.1.0. — [ISEC blog on zip disguises](https://blog.isec.pl/disguises-zip-past-path-traversal/); [GitLab advisory for unzipper](https://advisories.gitlab.com/pkg/npm/unzipper/CVE-2018-1002203); [Snyk zip-lib](https://security.snyk.io/vuln/SNYK-JS-ZIPLIB-13834403)
- OWASP File Upload Cheat Sheet:
  - ZIP files are "not recommended" because they can contain all types of files.
  - Archives can be ZIP bombs.
  - Check size limits after decompression.
  - Store uploads outside the webroot.
  - Generate filenames on the server (UUID).
  - Validate filenames after decoding.
  - Allow only a restricted character set and reject `:`.
  - Disallow leading periods, hyphens and spaces.
  - Set a maximum upload size.
  — [OWASP File Upload Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/File_Upload_Cheat_Sheet.html)
- Next.js guidance for secrets: env vars are server-only unless prefixed `NEXT_PUBLIC_`. Only the Data Access Layer should read `process.env`. Use `import 'server-only'`, and optionally the experimental taint APIs (`experimental.taint`) as an extra layer, not a replacement for sanitizing. — [Data security guide](https://nextjs.org/docs/app/guides/data-security)
- Use `connection()` from `next/server` before reading `process.env` when you need runtime (not build-time) values in 16, since `serverRuntimeConfig` is removed. — [Upgrade to v16 guide](https://nextjs.org/docs/app/guides/upgrading/version-16)
- Treat routes as directly callable: Server Actions are reachable by direct POST, so re-authenticate and authorize inside each. Return minimal values, and rate-limit expensive operations. — [Data security guide](https://nextjs.org/docs/app/guides/data-security)
- Image Optimization hardening in 16: local-IP optimization is blocked by default (`dangerouslyAllowLocalIP`), `maximumRedirects` defaults to 3 (SSRF-related), and `images.domains` is deprecated in favor of `remotePatterns`. — [Upgrade to v16 guide](https://nextjs.org/docs/app/guides/upgrading/version-16)

### Inferences
- Scan-path hardening recipe (my synthesis of the above; verify with tests):
  1. Define an allow-list root (for example a workspace or `REPOS_DIR`) and never accept absolute paths from clients. Prefer an opaque repo id mapped server-side to a path.
  2. `const real = await fs.realpath(path.resolve(root, rel))`, require `real === rootReal || real.startsWith(rootReal + path.sep)`. This defeats symlinks inside cloned repos, which a plain `resolve` check does not.
  3. Reject NUL bytes and use `lstat` to avoid following symlinks while walking. Skip `.git`, `node_modules` and files above a size cap.
  4. Apply the same containment check to every file read in the code-explorer and diff routes, not only at scan time.
- Safe clone handling (not directly sourced): use `git clone --depth 1` with a `child_process.execFile` argument array (never a shell string), validate the URL against an allowlist of `https://` hosts, set a timeout and size limit, disable hooks (`-c core.hooksPath=/dev/null`) and never execute repo content. A user-supplied URL can otherwise trigger SSRF or command injection via `--upload-pack`-style options.
- Zip uploads: use a maintained extractor, check each entry's resolved destination against the target dir, reject symlink entries, cap entry count and total uncompressed bytes, and extract into a fresh temp dir with a server-generated name.
- Settings route for API keys: never return the stored key (return only a masked suffix or a boolean `configured`), accept it only on POST over HTTPS, keep it out of logs and error messages, store it in an env var or a `0600` file outside the repo and web root (not in the JSON DB committed to git), and add `.gitignore` entries. If the app is meant to run locally only, bind to localhost and check the `Origin` or `Host` header on mutating routes, since there may be no auth.
- A scanner that parses untrusted repos with the TypeScript compiler is a DoS surface: add per-file and total time or size budgets.

### Gaps
- OWASP's Path Traversal page was not retrieved (the search returned secondary sources). The OWASP Cheat Sheet fetched covers uploads only.
- No primary source found for git clone hardening specifics, and the recipe above is unsourced.
- No source on secret storage for local-first tools (keychain vs env file) was gathered.
- Whether the project has any auth on its routes is unknown, so the localhost/Origin-check advice is conditional.

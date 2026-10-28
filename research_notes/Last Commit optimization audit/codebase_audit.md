# The Last Commit - Codebase Audit (read-only, 2026-10-28)

Sources are repo files cited as `path:line` (paths relative to /Users/kunalkumar/Desktop/Gautam/lastweek_hack). No web sources were used; none were needed. Commands run: `npx tsc --noEmit`, `npm run build`, `npm audit --omit=dev`, `npx browserslist`. Nothing in the project was modified.

## Q1. What does each module do and how do they connect?

### Takeaway
A single in-process JSON-file store (`src/lib/store.ts`) is the hub. API routes call the store, the store calls `scanner.ts` and `resurrection.ts`, and `ghost-ai.ts` is called directly by the chat route. `src/lib/mastra/index.ts` and `src/lib/ast-analyzer.ts` are not imported by anything, so they are dead code. The "Mastra" layer is a plain class with no `@mastra/*` dependency.

### Cited Findings
- `src/lib/types.ts` (177 lines): shared interfaces (Repository, AutopsyFinding, PatchProposal, VerificationRun, etc.).
- `src/lib/store.ts:17` persists the whole DB to `process.cwd()/.lastcommit_data.json`. It seeds 3 fake "graveyard" repos (store.ts:41-112). All three point at the same `examples/broken-js-app` (store.ts:52,70,88). Methods:
  - `runAutopsy` (168-242) calls `scanRepository` synchronously and fakes job progress and events.
  - `getFindings/getArchitecture/getPatch` auto-run a scan or patch generation when nothing is cached (244-257, 283-288).
  - `verifyPatch` (290-308) calls `runSandboxVerification`.
  - `getReport` (315-339) rebuilds and persists a report on every call.
- `src/lib/scanner.ts` (406 lines): `scanRepository(repoPath, repoId)`. It walks the tree and counts LOC (70-110). It analyzes package.json for engines, deprecated deps and test script (112-259). It runs regex checks for deprecated Node APIs and broken relative imports (262-344). It builds the ArchitectureSummary and healthScore (346-371). It is the only analyzer actually wired in.
- `src/lib/ast-analyzer.ts` (194 lines): TypeScript-compiler-API visitor `analyzeFileAst`. It detects `new Buffer`, `crypto.createCipher`, `fs.exists`, `sys.puts/util.print`, and broken `require`/`import`. Importers are limited to `src/lib/mastra/index.ts:5`. Grep found no other importer.
- `src/lib/mastra/index.ts` (242 lines): zod schemas (12-45, never used to validate anything), 4 "tools" that are plain objects with `execute` (51-131), and `MastraRecoveryWorkflow` with 5 stage methods (137-241). Grep for `mastra|MastraRecovery` outside that file finds only prose in DEV_SUBMISSION.md:4,77 (which describes the Mastra layer as `src/lib/ghost-ai.ts`). `package.json` has no `@mastra/*` dependency. Its stage 2 would duplicate scanner.ts.
- `src/lib/ghost-ai.ts`: `askGhostAgent` builds a grounded prompt (top 8 findings, 15 files; 40-57). It POSTs to Ollama `/api/chat` with a 6s abort (60-82). On any failure or non-OK response it falls through to keyword-matched canned replies (112-138). Citations are derived by substring-matching file paths in the reply (89-100, 141-152).
- `src/lib/resurrection.ts`: `generatePatchProposal` applies regex rewrites to package.json and to files named in findings (7-141). `runSandboxVerification` runs `node test.js` in the repo (baseline), copies the repo to `/tmp/last-commit-sandbox-<ts>`, overwrites patched files, runs again, and rm's the dir (143-230). `executeCommandInDir` uses `exec` with a 15s timeout (232-242).
- API routes (all `src/app/api/**/route.ts`): 
  - `GET/POST /repositories` list and import.
  - `GET /repositories/[id]` returns repo, findings, architecture, patch and verification (this triggers scan and patch creation as side effects).
  - `POST /repositories/[id]/analyze` re-runs the scan.
  - `GET/POST /repositories/[id]/patches`.
  - `GET /repositories/[id]/files` returns the file tree or `?file=` content.
  - `GET/POST /repositories/[id]/chat`.
  - `POST /patches/[id]/verify`.
  - `GET/POST /settings`.
- Pages: `src/app/{page,graveyard,settings}`, `src/app/lab/[id]/{page,autopsy,ghost,resurrection,report}`. Every lab page does its own `fetch('/api/repositories/${id}')` in a `useEffect` (e.g. lab/[id]/page.tsx:36-37, autopsy/page.tsx:29-30, report/page.tsx:31-32, resurrection/page.tsx:35-36, ghost/page.tsx:22). There is no `lab/[id]/layout.tsx` (directory listing).
- `src/components/LabTabs.tsx` (78 lines): breadcrumb plus 5 tab links, active state by `usePathname` (55-57). It is purely presentational.
- `src/components/CodeExplorer.tsx` (171 lines): fetches the flat file list, then file contents via `/files?file=` (26-51). It maps findings to files (54-62) and highlights flagged lines per row (135-163).
- `src/components/DiffViewer.tsx` (181 lines): file tabs, unified or "split" view, copy and download `.patch` (26-40). Unified colors lines by prefix (115-138). Split view prints `originalContent` and `patchedContent` in two columns (141-176).
- `scripts/test-resurrection.js`: runs `node test.js` in the broken and repaired examples and checks that 12 files exist (39-64). It never imports or exercises src/ code.

### Inferences
- Data flow: UI page -> `/api/repositories/[id]` -> store (JSON file, in memory) -> scanner / resurrection (sync fs) -> JSON response. Chat adds Ollama with a canned-text fallback. Verify adds `child_process.exec`.
- Roughly 440 lines (ast-analyzer + mastra) ship unused, while README and DEV_SUBMISSION advertise "deep AST" and "Mastra" capabilities.

### Gaps
- Pages (`src/app/**/page.tsx`, 1079 lines total) were only grepped, not read line by line; render-level findings for them are limited to fetch patterns.

## Q2. Concrete defects and inefficiencies, ranked

Severity: C critical, H high, M medium, L low. Effort: S (under 1h), M (half-day), L (day or more).

### Takeaway
The most serious class is unauthenticated, arbitrary-path file read and code execution through `localPath` import plus the verify route. After that come patch generation that emits broken code and a fabricated fallback patch that overwrites package.json in the sandbox, and a non-atomic, synchronous whole-DB JSON store.

### Cited Findings: security

| # | Sev | Effort | Finding |
|---|---|---|---|
| S1 | C | M | Arbitrary directory import. `POST /api/repositories` accepts any `localPath` and only checks `fs.existsSync` (repositories/route.ts:19-30). No allow-list, no auth, no schema validation. Setting `localPath` to `/` or `~` makes `/files?file=...` (files/route.ts:25-34) read any file the server can read (the check is relative to the attacker-chosen workspace), and makes the sync scan walk the whole disk (DoS). |
| S2 | C | M | Arbitrary code execution. `POST /api/patches/[id]/verify` runs `node test.js` via `exec` in the real repo dir (resurrection.ts:151, 232-234) and in the copy (169). Combined with S1, an attacker can import a directory they control and run their own `test.js` on the host. The env passes the full `process.env` (234), which exposes any secrets in the server environment to that code. The "sandbox" is only a `/tmp` directory copy, with no container, user separation, network block or resource limits. |
| S3 | H | S | Prefix-only path-traversal check. `fullPath.startsWith(path.resolve(workspacePath))` with no trailing separator (files/route.ts:27, mastra/index.ts:90). `/ws/app` also admits `/ws/app-secrets/x`. Symlinks are not resolved (no `realpath`), so a symlink inside a repo escapes. Fix: compare `path.relative` to the root, or `startsWith(root + path.sep)`, after `realpath`. |
| S4 | H | S | Mass assignment on settings. `store.updateSettings(body)` spreads the unvalidated body into settings (settings/route.ts:42-43, store.ts:346-349). `zod` is installed but unused in the routes. Setting `ollamaEndpoint` to an internal URL makes the server fetch it on every `GET /settings` (settings/route.ts:14) and on chat (ghost-ai.ts:64): SSRF. Unexpected keys are persisted into the JSON file. |
| S5 | M | S | No input validation anywhere: `req.json()` is destructured without type checks (repositories/route.ts:18-19). `id` route params are used as lookup keys with no format check. Errors return `error.message` to the client (every route's catch), which leaks internal paths. |
| S6 | M | S | `copyRecursiveSync` uses `statSync`/`copyFileSync` which follow symlinks (resurrection.ts:244-258). A repo containing a symlink to a directory outside the workspace (or a cycle) is copied into `/tmp` or loops until stack overflow. The sandbox dir name `Date.now()` in a world-writable `/tmp` (154) is predictable. Use `fs.mkdtempSync(os.tmpdir())`. |
| S7 | M | S | Verify route id parsing. For `patch_<repoId>_<ts>` it does `id.split('_')[1]` (patches/[id]/verify/route.ts:12-14). Imported repos have ids like `repo_abc123` (repositories/route.ts:52), so a patch id `patch_repo_abc_xyz` resolves to repoId `"repo"` and the call fails. Today the UI works only because the page passes `patch.id`; check resurrection/page.tsx:65 and confirm it behaves differently for imported vs seeded repos (not run). |
| S8 | M | S | Dependency audit (`npm audit --omit=dev`): 4 vulnerabilities (1 critical, 2 high, 1 low). Flagged packages include `next`, `postcss` (via next), `diff` (6.0.0-8.0.2 range) and `zod <4.6.6`. The suggested fixes need major bumps (next 16, zod 4). The critical one was attributed to `next` in the output tail; I did not capture the full advisory text. |
| S9 | L | S | `.lastcommit_data.json` is tracked in git (git ls-files) and not in `.gitignore`. It contains the absolute path `/Users/kunalkumar/Desktop/Gautam/lastweek_hack/examples/broken-js-app` (file head), so the committed seed is wrong on any other machine, and every user mutation dirties the repo. |
| S10 | L | S | No secrets found: no `process.env` secret reads, `.env` is git-ignored (.gitignore). Ollama endpoint is local default (store.ts:32). No auth or CSRF/origin check on any mutating route; fine for a local demo, not for hosting. |

### Cited Findings: correctness bugs

- C/M: `fs.exists` regex rewrite emits invalid or incorrect code: `'const exists = fs.existsSync($1);\n  (($2) => {'` (resurrection.ts:84). It leaves the original callback body in an arrow IIFE with no call and no `exists` argument. The verification could still pass vacuously. Effort M (use AST transforms).
- H/S: `crypto.createCipher(` is blind-renamed to `createCipheriv(` with no IV or key derivation (resurrection.ts:87). The result throws at runtime (`createCipheriv` needs key and IV), while the UI summary claims "Replaces deprecated Buffer/crypto constructors" (135).
- H/S: Fabricated fallback patch. If no diff was generated, the code invents a fake package.json named `revival-target` and a hand-written diff with wrong hunk header (`@@ -5,1 +5,3 @@`) (resurrection.ts:120-129). `runSandboxVerification` then writes that content over the real package.json in the sandbox (162-166), so a "passed" verification can run against a replaced manifest.
- M/S: `new Buffer(([^)]+))` regex fails on nested parentheses, e.g. `new Buffer(foo(bar))` (resurrection.ts:81); it also rewrites matches inside comments and strings.
- M/S: Engine check uses `engineSpec.includes('8')/'10'/'12'/'14'` (scanner.ts:125). `">=18.0.0"`, `">=20.10"` or `"^20.14"` are flagged as outdated Node, a false positive that also drives the health score. Use `semver`-style parsing.
- M/S: `'querystring'` is a Node built-in listed as a deprecated npm dependency (scanner.ts:20). The dependency table is duplicated in mastra/index.ts:113-121 and has already drifted (lacks `querystring` and `colors`).
- M/S: ast-analyzer picks `ScriptKind.TS` for `.tsx` and `JS` for `.jsx` (ast-analyzer.ts:32), so JSX files get parse errors (the code does not check `parseDiagnostics`). `repoRoot` parameter is unused (22).
- M/S: Hard-coded values in chat route: every file gets `loc: 50, language: 'javascript'` (chat/route.ts:55); the directory walk skips only 3 names (50) vs 6-7 elsewhere; `settings.temperature` is ignored (ghost-ai.ts:77 hard-codes 0.2); `sandboxTimeoutSeconds` is ignored (resurrection.ts:234 hard-codes 15000); `enableFallback` and `autoVerify` are not read anywhere I found (grep not exhaustive for the pages).
- M/S: 6s Ollama timeout (ghost-ai.ts:62) is shorter than a cold gemma3:4b model load, so the first questions silently fall back to canned text with no indication in the reply. The fallback is indistinguishable in the UI.
- M/S: `offlineVerified: true` is hard-coded in the report (store.ts:333) even if no verification ran. `getReport` re-creates and persists the report on every GET (315-339). Report summary claims "executed sandbox verification" unconditionally (328).
- M/S: Imported GitHub URLs are not cloned: any URL maps to the sample workspace (repositories/route.ts:46-47), with random stars and forks (61-62), fixed `deathYear: 2021` (65), and fake commit SHA (58). This is misleading product behavior if presented as real import.
- L/S: Job events and progress are scripted (`progress: 35`, static `evt_1..3`, store.ts:179-198); the "job" completes synchronously before it is stored.
- L/S: `repo_${Date.now().toString(36)}` ids can collide on two imports in the same millisecond (repositories/route.ts:52). `Math.random()` SHA.
- L/S: Messages: IDs use `Date.now()` (chat/route.ts:64,89) and can collide when user and assistant messages land in the same millisecond. Ghost context `recentMessages` is read before the new message is saved, so the prompt includes the previous 4 only (chat/route.ts:41, ghost-ai.ts:72). This is acceptable but the current user turn is appended separately (73).
- L/S: `CodeExplorer` flags a line as defective if any finding has `lineStart === lineNum` or covers it (CodeExplorer.tsx:137-139), but package.json findings have synthetic lines `1`/`5` (scanner.ts:157-158, 208-210), highlighting arbitrary lines.

### Cited Findings: performance

| # | Sev | Effort | Finding |
|---|---|---|---|
| P1 | H | M | `.lastcommit_data.json` store: every mutation, including each chat message, report GET, and settings change, calls `writeFileSync(JSON.stringify(db, null, 2))` of the entire DB (store.ts:140-150, 268, 278, 336). The DB embeds full `originalContent` and `patchedContent` of patched files and all findings (resurrection.ts:51-56). Cost grows O(total data) per write, and pretty-printing inflates size. The event loop blocks during the write. |
| P2 | H | M | Non-atomic, unlocked persistence. Plain `writeFileSync` with no temp-file plus `rename`, no lock. A crash or two concurrent requests can truncate the file. On parse failure `load()` swallows the error and then **overwrites the corrupt file with seed data** (store.ts:121-138), destroying user data silently. |
| P3 | M | S | Singleton not HMR/route-isolated. `export const store = new Store()` (store.ts:353) is module-scoped. In Next dev and in separate route bundles, multiple instances can hold divergent in-memory copies, each overwriting the file with its own state. Use `globalThis` caching or a real DB (SQLite). |
| P4 | H | M | Reads cause writes and heavy work. `GET /api/repositories/[id]` can run a full autopsy, generate a patch and persist the DB (route.ts:15-18 -> store.ts:244-257, 283-288). Every lab page calls it (5 tabs), returning findings + architecture + full patch contents each time, with no caching or `Cache-Control`. A shared `lab/[id]/layout.tsx` plus a data cache would fetch once. |
| P5 | H | M | Blocking sync I/O in request handlers: `fs.readdirSync/statSync/readFileSync/existsSync` throughout scanner.ts (71-94, 266), resurrection.ts, files/route.ts (39-54), chat/route.ts (47-59), mastra/index.ts. A large repo blocks the Node event loop for all users. Use `fs.promises` with bounded concurrency, or a worker. |
| P6 | M | S | Whole-file reads just to count lines. scanner.ts:93, files/route.ts:50, mastra/index.ts:69 read every file's content (including binaries/lockfiles/huge JSON) to compute `loc`. The scanner then re-reads each source file (scanner.ts:266). No size cap (use `stat.size` threshold or stream count). The `/files?file=` endpoint also returns files of any size and any type (files/route.ts:33). The chat route walks the tree on every message (chat/route.ts:45-60) even though only 15 files are used (ghost-ai.ts:44). |
| P7 | M | S | Quadratic line lookup. For every regex match the scanner does `content.substring(0, idx).split('\n').length` (scanner.ts:274-275, 314-315). Precompute line-start offsets once per file. Up to 8 `existsSync` per import (310-311) duplicated in ast-analyzer.ts:129-130,163-164. |
| P8 | M | S | `exec` buffers stdout/stderr with the default `maxBuffer` (1 MiB), no kill signal escalation, and no cleanup of child processes on timeout (resurrection.ts:234). A repo's `test.js` that floods output makes `exec` error. |
| P9 | L | M | Scanner/AST cost: the TypeScript compiler (`import ts from 'typescript'`, ast-analyzer.ts:1) is a ~tens-of-MB devDependency (`package.json` devDependencies; `typescript` is not in `dependencies`). If ast-analyzer is wired in, it must move to `dependencies` and be listed in `serverComponentsExternalPackages` (Next 14), otherwise production installs and bundling break or bloat. `createSourceFile` per file is cheap per file but there is no cache and no file-size cap. Currently zero cost since it is dead code. |
| P10 | M | S | `CodeExplorer` renders every line of the file as a DOM node (CodeExplorer.tsx:135-163) and for each line runs `currentFileFindings.find(... evidence.some ...)` (137-139), O(lines x findings) on every render, with no `useMemo`. `fileFindingsMap` is rebuilt on every render (54-62). The file list is flat and unvirtualized (101-124). Large files will lag. Fix: `useMemo` per-line set, virtualize or cap lines. |
| P11 | M | S | `CodeExplorer` fetch effects have no `AbortController`, no `.catch`, and no cancelled flag (26-51). Fast file switching can set stale content (out-of-order responses); a failed fetch leaves `loadingContent` handled by `finally` but shows stale/empty content with no error. A non-success response silently keeps the previous file's content (46-48). |
| P12 | L | S | `DiffViewer` recomputes `split('\n')` of three strings on every render (42-44, including on copy-state change) with no `useMemo`. "Split" view is not a diff: it prints the full original and patched files side by side with no alignment or change highlighting (141-176), and `truncate` on a `whitespace-pre` span hides long lines (155, 171). `navigator.clipboard.writeText` promise is unhandled and fails on non-HTTPS (27). `selectedIdx` is not reset if `files` changes (13). The `-mx-4 block` background trick (120-127) is fragile. |
| P13 | L | S | `LabTabs` is light; re-renders only with pathname. Minor: tab array rebuilt each render (17-23); `pathname.startsWith(tab.href)` could mis-match prefixes (57). Not a performance concern. |

### Cited Findings: type-safety and code quality

- `strict: true` is set (tsconfig.json) and `npx tsc --noEmit` passes, but there are 19 occurrences of `: any` / `as any` in `src` (grep count), notably `manifest: any` (scanner.ts:9,114; mastra/index.ts:112,213), `files: any[]` (mastra/index.ts:213), `catch (err: any)` everywhere, `(m: any)` (settings/route.ts:19), `payload?: Record<string, any>` (types.ts:40).
- Empty catch blocks swallow errors (store.ts:132-134, 143-145; scanner.ts:103-105, 340-342; resurrection.ts:58-60, 114-116; chat/route.ts:59). Failures become silent empties.
- Route handlers have untyped bodies; the zod schemas in mastra/index.ts (12-45) are the only schemas and are unused; `FindingSchema` omits `repositoryId` and `status` that the `AutopsyFinding` type requires, so it would not match real data.
- Duplication: file-walk logic is copied in 5 places (scanner.ts:70-108, files/route.ts:39-55, chat/route.ts:47-58, mastra/index.ts:57-78, resurrection.ts:244-258); `getLanguageFromExt` exists in scanner but the others inline a different, inconsistent mapping (files/route.ts:49, mastra/index.ts:68). The seven near-identical diagnostic push blocks in ast-analyzer.ts (44-183) would collapse to a helper. Health score formula is duplicated (scanner.ts:359, mastra/index.ts:218) and counts a critical finding 28 points (25 + 3).
- Unused imports in components: `FileCode, Check, ShieldAlert` in CodeExplorer.tsx:4 (`Folder` used, `Check` and `ShieldAlert` not rendered in the file body I read); `AutopsyFinding, FindingCategory, FindingSeverity` imports are used in scanner. Not exhaustive; run `next lint`/eslint (no eslint config exists in repo: `.eslintrc*` is absent from git ls-files, so `npm run lint` would prompt interactively).
- Missing tests: no unit, integration or API tests, no test framework in devDependencies, no `test` script. `test:sample` (package.json scripts) only runs `node test.js` in the examples and checks that 12 files exist (scripts/test-resurrection.js:39-64). It never loads `src/` modules, so scanner, store, resurrection and routes have zero automated coverage. Highest-value tests: path-traversal on `/files`, scanner engine-version parsing, patch regexes, store corruption recovery, verify route.

### Inferences
- S1 + S2 chain gives full remote code execution if the dev server is bound beyond localhost (Next dev binds all interfaces by default only when `-H` is set; default `next dev` is localhost, so exposure depends on deployment; I did not test).
- P1-P4 are small for the 3-repo demo but grow linearly with chats and patches; a SQLite or per-repo JSON file with atomic writes would be the cheapest fix.
- Dead code (ast-analyzer, mastra, unused zod schemas) plus README claims is a credibility risk for a hackathon submission; either wire the AST analyzer into `scanRepository` or remove the claims.

### Gaps
- Did not read every page file; page-level re-render issues (settings, graveyard, ghost) are not assessed beyond fetch patterns.
- Did not start the server or exercise the endpoints, so S1/S2/S7 are from code reading, not reproduced.
- `npm audit` per-package advisory details were only partially captured; advisories for `next` and `diff` were not individually read.

## Q3. Does `tsc --noEmit` and `npm run build` pass?

### Takeaway
Both pass (Node v24.3.0, Next 14.2.35). The build's lint step reported nothing and no warnings were printed.

### Cited Findings
- `npx tsc --noEmit`: no output, `exit 0`.
- `npm run build`: "Compiled successfully", "Linting and checking validity of types" with no errors, 8/8 static pages generated. All 8 API routes and `/lab/[id]*` are dynamic (`ƒ`); `/`, `/graveyard`, `/settings` are static. First Load JS shared is 87.3 kB; page routes 91-102 kB. Largest page `/lab/[id]/resurrection` 5.69 kB (102 kB first load).
- Build output also confirms `lab/[id]` pages are server-rendered on demand but are `'use client'` fetchers, so there is no SSR data benefit.
- `next lint` has no ESLint config, so lint coverage is effectively none (no `.eslintrc*` in `git ls-files`). The build says "Linting" but with no config Next skips rule checks.

### Inferences
- Type-check cleanliness does not reflect runtime safety: the `any` usage and unvalidated JSON bodies mean runtime type errors will not be caught.

### Gaps
- Did not run `npm run lint` or `npm run test:sample`.

## Q4. Deleted `.browserslistrc` and duplicate browserslist in package.json

### Takeaway
`.browserslistrc` is deleted in the working tree (`git status`: ` D .browserslistrc`) but still present in HEAD. Deleting it is correct and should be committed. Having both is an error in Browserslist.

### Cited Findings
- `git show HEAD:.browserslistrc` content is exactly `defaults`; `package.json` has `"browserslist": ["defaults"]` (package.json, `browserslist` key). Identical query, so no behavior changes from removal.
- `node_modules/browserslist/node.js:443-446` throws `BrowserslistError(dir + ' contains both .browserslistrc and package.json with browsers')` when a directory has both. In the committed state, any tool that resolves the config from the repo root (autoprefixer/postcss via Next, `npx browserslist`) would hit this error. With the file deleted, `npx browserslist` resolves normally (output began `and_chr 156 / and_ff 158 / ...`), and `npm run build` succeeds.
- It was added in the initial commit c1b7659 (`git log -- .browserslistrc`).

### Inferences
- Commit the deletion and keep a single source (package.json or `.browserslistrc`). "defaults" is the implicit default, so the entry could be dropped entirely. Alternatively, pick explicit targets (e.g. `last 2 versions, >0.5%`) if they matter.

### Gaps
- Did not verify whether the committed duplicate actually fails `next build` on a clean checkout (the repo state already had the file deleted when I ran the build).

## Prioritized fix list (severity, effort)

1. C/M: Restrict `localPath` to an allow-listed root; validate with zod; require realpath containment (S1, S3). Gate verify behind explicit opt-in, run in a container or at minimum with a scrubbed env (S2).
2. H/S: Fix `startsWith` path check (S3); validate settings with zod and allow-list the Ollama host (S4).
3. H/S: Remove the fabricated fallback patch (resurrection.ts:120-129) and the blind `createCipher` rename (87); mark patches as "suggestion only" where no safe transform exists.
4. H/M: Replace the JSON blob store with atomic writes (`tmp` + `rename`), debounce, `globalThis` singleton, and do not overwrite on parse failure (P1-P3). Remove `.lastcommit_data.json` from git and `.gitignore` it (S9).
5. H/M: Move reads off GET write paths; add `lab/[id]/layout.tsx` data provider to fetch once (P4); async fs with size caps (P5, P6).
6. M/S: Fix engine check (scanner.ts:125), `querystring` entry (20), `.tsx` ScriptKind (ast-analyzer.ts:32), verify-id parsing (S7), hard-coded chat file info (chat/route.ts:55), ignored settings (temperature, timeout).
7. M/S: `CodeExplorer` memoization, abort and error handling, line virtualization; DiffViewer real side-by-side (P10-P12).
8. M/S: Commit `.browserslistrc` deletion (Q4). Update dependency advisories (S8).
9. M/M: Decide on dead code: integrate ast-analyzer into the scanner (and move `typescript` to dependencies) or delete it and `mastra/index.ts`; correct README and DEV_SUBMISSION claims.
10. M/M: Add a test runner (Vitest or `node:test`) with tests for the items in the "Missing tests" bullet; add an ESLint config.

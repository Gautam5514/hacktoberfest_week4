# Mastra workflows, TS-AST analysis, and LLM patch pipelines for The Last Commit (as of 2026-10)

## Mastra: current workflow API and whether this project's use is idiomatic

### Takeaway
Mastra's current API is `createStep` / `createWorkflow(...).then()/.branch()/.parallel()/.foreach().commit()` with Zod (or any Standard-JSON-Schema lib) input/output schemas, registered on a `Mastra` instance. The project does NOT use Mastra at all: `package.json` has no `@mastra/*` dependency, and `src/lib/mastra/index.ts` is a hand-rolled class (`MastraRecoveryWorkflow`) with plain-object "tools" and five sequential methods. It is not idiomatic and gets none of Mastra's retries, suspend/resume, snapshots or tracing.

### Cited Findings
- `createStep({ id, inputSchema, outputSchema, execute: async ({ inputData }) => ... })`; `createWorkflow({ id, inputSchema, outputSchema }).then(step).commit()`; schemas may be Zod, Valibot, ArkType or any Standard JSON Schema lib — [Mastra workflows overview](https://mastra.ai/docs/workflows/overview)
- Run: `const run = await wf.createRun(); const result = await run.start({ inputData })`; `result.status` is a discriminated union `success | failed | tripwire | suspended | paused`; `failed` exposes `result.error`; `suspended` exposes `suspendPayload` and suspended step paths — [Mastra overview](https://mastra.ai/docs/workflows/overview)
- Shared workflow state: declare `stateSchema`, use `state`/`setState` in `execute` instead of threading values through every schema — [Mastra overview](https://mastra.ai/docs/workflows/overview)
- Register workflows in `new Mastra({ workflows: {...} })` and fetch with `mastra.getWorkflow('key')` (preferred over direct import, gives access to instance config such as logging/observability); `cloneWorkflow` gives separately-identified copies in observability — [Mastra overview](https://mastra.ai/docs/workflows/overview)
- Workflows can be nested by passing a workflow to `.then()` — [Mastra overview](https://mastra.ai/docs/workflows/overview)
- Retries: step-level `retries: 3` on `createStep`; workflow-level `retryConfig: { attempts, delay }` on `createWorkflow`, step setting overrides. `bail()` in a step ends the workflow early with a success payload; throwing fails the step; catch-and-return a status then `.branch([...])` for fallback paths; `options.onError` runs only when the workflow fails (status `failed`/`tripwire`) and errors inside it are swallowed/logged — [Mastra error handling (@mastra/core 1.51 docs)](https://cdn.jsdelivr.net/npm/@mastra/core@1.51.0/dist/docs/references/docs-workflows-error-handling.md)
- Suspend/resume: `suspend()` inside a step pauses; resuming with `resumeData` matching the step's `resumeSchema`; snapshots are auto-persisted to configured storage and survive restarts/deploys; if only one step is suspended the step arg can be omitted — [Mastra suspend & resume](https://mastra.ai/en/docs/workflows/suspend-and-resume), [snapshots](https://mastra.ai/docs/workflows/snapshots)
- Doc-version drift: search results mixed v0, 1.25, 1.50, 1.51 docs and community pages showing both `retries` and `retryConfig`; verify against installed `@mastra/core` types — [search results](https://mastra.ai/docs/workflows/suspend-and-resume.md)
- Project facts (read locally): `src/lib/mastra/index.ts` defines Zod schemas (`FileItemSchema`, `FindingSchema`, never used to validate anything), tools as `{id, description, execute}` literals (not `createTool`), and `MastraRecoveryWorkflow` with `runStage1..5` methods called imperatively. `package.json` lists `zod ^3.23.8`, `typescript ^5.6.3`, `diff ^7.0.0`, no mastra or anthropic SDK.

### Inferences
- Recommended structure: steps `discover -> staticDiagnosis (AST + manifest, can run in `.parallel`) -> reason -> proposePatch -> verify -> (branch: passed => finish; failed && attempts<N => repair loop via `.dountil`/`.branch`; else suspend for human review)`. Each step gets a real Zod schema; keep `repoPath`/`repoId` in `stateSchema` rather than in every payload.
- Use `suspend()` for the "never modify files without user approval" rule that the Ghost prompt already states; this is exactly Mastra's human-in-the-loop use case.
- Put LLM calls in steps with `retries: 2-3` and use `bail`/branch for non-retryable (e.g. schema-refusal) outcomes; add `onError` for logging.
- If adding Mastra is too heavy for a hackathon, at minimum rename the class (it is misleading) and add real Zod `.parse` at stage boundaries.

### Gaps
- Did not retrieve the Mastra Control Flow, Agents, or observability/tracing pages; exact `.dountil`/`.foreach` signatures and tracing exporter config are unverified.
- Did not confirm which `@mastra/core` version is current in Oct 2026 (docs seen reference 1.51).

## TypeScript AST analysis: performance and correctness

### Takeaway
`createSourceFile` is fast and fine for purely syntactic checks, but anything needing semantics (is this `exists` really `fs.exists`? is this symbol `@deprecated`? does an import resolve?) needs one shared `ts.Program` + `TypeChecker` built once per repo, not per file.

### Cited Findings
- `createProgram` is the entry point representing the whole application, and `program.getTypeChecker()` gives `getSymbolAtLocation`, `getTypeAtLocation`, `typeToString`; `createSourceFile` parses one file without a program and "for pure traversal, a type checker is not needed" — [TypeScript wiki: Using the Compiler API](https://github.com/microsoft/TypeScript/wiki/Using-the-Compiler-API)
- `ts.getPreEmitDiagnostics(program)` returns syntactic+semantic diagnostics, including unresolved-module errors (code 2307) that could replace hand-rolled `fs.existsSync` import checks — [Compiler API wiki](https://github.com/microsoft/TypeScript/wiki/Using-the-Compiler-API)
- Incremental options: `BuilderProgram` (`createSemanticDiagnosticsBuilderProgram` etc.) caches results for unchanged modules; `createWatchProgram`; or Language Service with file versions — [Compiler API wiki](https://github.com/microsoft/TypeScript/wiki/Using-the-Compiler-API)
- TypeScript itself does not report deprecated-usage as errors; tools resolve the symbol with the checker and read its JSDoc tags (`@deprecated`). typescript-eslint `no-deprecated` and oxlint `typescript/no-deprecated` do this and are the reference implementations — [typescript-eslint no-deprecated](https://typescript-eslint.io/rules/no-deprecated/), [oxc no-deprecated](https://oxc.rs/docs/guide/usage/linter/rules/typescript/no-deprecated), [TS playground JSDoc @deprecated](https://www.typescriptlang.org/play/4-0/new-js-features/jsdoc-deprecated.ts)
- Project facts: `ast-analyzer.ts` calls `ts.createSourceFile` per file, matches calls by text (`node.expression.getText() === 'fs.exists'`), and checks relative imports with `fs.existsSync` over a fixed extension list; uses `ScriptKind.TS` for .ts/.tsx (so .tsx parsed as TS, not TSX) and JS otherwise (so .jsx/.mjs/.cjs parsed as JS, but .jsx gets no JSX-specific kind). `ghost-ai.ts` / `scanner.ts` skip `node_modules`, `.git`, `.next`, `dist`, `build`, `coverage` only by exact directory name.

### Inferences
- Text matching `fs.exists` misses `const { exists } = require('fs')`, `import fs from 'node:fs'` aliasing, and false-positives on any user object named `fs`/`crypto`. Use the checker (`getSymbolAtLocation` -> declaration file path contains `@types/node`/`node:fs`) or at least track import bindings.
- For legacy JS repos, create the program with `allowJs: true, checkJs: false, noEmit: true, skipLibCheck: true, noResolve` as appropriate, `types: ['node']`, and `include`/explicit root list built from your filtered file inventory (this also avoids scanning `node_modules` as root files; imports into `node_modules` still get resolved lazily). Use `ts.ScriptKind.TSX/JSX` by extension, or let the program pick via `getScriptKind` from extension.
- Build the file list once (the workflow already has it from `listFiles`) and share it; currently the repo is walked at least twice (listFiles and scanner) and every file is read twice.
- Replace regex fixers in `resurrection.ts` with AST-range edits (see next section).
- ts-morph: I could not retrieve its performance page (404). General tradeoff (unsourced here): ts-morph gives nicer manipulation/refactor APIs but wraps the same Program and adds overhead; for read-only detection raw compiler API is lighter, for codemod-style patch application ts-morph or `ts.TextChange`-style range edits are easier.

### Gaps
- No benchmark numbers found for createProgram vs per-file parse on legacy repos.
- ts-morph docs not retrieved; claims about its overhead are unverified.
- Did not check whether the TypeScript native (Go) port is stable/default in 2026 and how it affects the JS compiler API; verify before depending on `typescript` 5.x API long-term.

## LLM patch generation and verification

### Takeaway
Use Claude structured outputs (`output_config.format` with a JSON schema, `zodOutputFormat`) for proposals, apply patches as validated edits against known text, cache the stable prefix, and verify in an isolated sandbox with before/after runs. The project currently has no LLM patch generation at all: `resurrection.ts` is regex replacement.

### Cited Findings
- Structured outputs: pass `output_config: { format: zodOutputFormat(Schema) }` to `client.messages.parse(...)` (TypeScript/Zod) and get typed `parsed_output`; guarantees schema-valid JSON, no parse retries — [Anthropic structured outputs](https://platform.claude.com/docs/en/build-with-claude/structured-outputs)
- Supported on Fable 5.1, Opus 5.5, Sonnet 5.5, Haiku 5.5 (among others) — [Anthropic structured outputs](https://platform.claude.com/docs/en/build-with-claude/structured-outputs)
- Limits: no recursive schemas, no `minimum/maximum`, no `minLength/maxLength`, `minItems` only 0/1, `additionalProperties:false` required; Zod helpers move unsupported constraints into descriptions and validate client-side — [Anthropic structured outputs](https://platform.claude.com/docs/en/build-with-claude/structured-outputs)
- Edge cases: `stop_reason: "refusal"` or `"max_tokens"` can yield output not matching schema; first use of a schema adds compile latency (cached 24h); changing `output_config.format` invalidates the prompt cache for that thread — [Anthropic structured outputs](https://platform.claude.com/docs/en/build-with-claude/structured-outputs)
- Prompt caching: top-level `cache_control` (automatic) or up to 4 explicit breakpoints; prefix order tools -> system -> messages; 5-min TTL default, `ttl: "1h"` optional; minimum cacheable prefix 512 tokens for Fable 5.1, Opus 5.5, Sonnet 5.5, Haiku 5.5; write 1.25x (5m) / 2x (1h); read 0.1x base, but 0.05x on Opus 5.5 and Sonnet 5.5 and 0.025x on Fable 5.1; verify via `cache_read_input_tokens` — [Anthropic prompt caching](https://platform.claude.com/docs/en/docs/build-with-claude/prompt-caching)
- Opus 5.5 example pricing from the same page: base input $4/MTok, output $20/MTok, 5m write $5, read $0.20 — [Anthropic prompt caching](https://platform.claude.com/docs/en/docs/build-with-claude/prompt-caching)
- Project facts: `ghost-ai.ts` calls local Ollama `gemma3:4b` with a 6 s abort timeout and falls back to keyword-matched canned text (so users may get canned answers presented as AI); its system prompt has good safety rules (untrusted repo content, no invented files, evidence citations). `runSandboxVerification` copies the repo to `/tmp/last-commit-sandbox-*` (skipping node_modules), runs `exec(cmd)` with `process.env` inherited, 15 s timeout, no network/resource isolation, and the baseline test runs directly in the original repo path (unpatched, unsandboxed). `createTwoFilesPatch` from `diff` builds the diff; patched content is written whole-file, so no diff is ever "applied" or validated. Fallback branch fabricates a fake `package.json` diff when nothing matched.

### Inferences
- Pipeline design: for each finding group (by file), send only the AST-extracted window (enclosing function + imports + the deprecation message) rather than whole files; request `{ edits: [{ file, startLine, endLine, expectedOriginal, replacement, rationale, findingId }] }` via structured outputs. Reject any edit where `expectedOriginal` does not exactly match the file slice (hallucination guard), where the file/finding id is unknown, or where the file path escapes the repo.
- Generate the unified diff yourself from validated edits (`createTwoFilesPatch`/`structuredPatch`) rather than trusting model-written diffs; use `applyPatch` from `diff` as a round-trip check.
- After applying, re-parse with the TS program (syntax errors, `getPreEmitDiagnostics` delta vs baseline, re-run the same AST detectors to confirm the finding disappeared), then run tests. Feed failing diagnostics/stderr back for at most 2-3 repair iterations; this loop maps onto a Mastra repeat/branch step.
- Sandbox: run in a throwaway container or at minimum a temp dir with scrubbed env (no API keys), `--network none`/no install scripts (`npm ci --ignore-scripts`), CPU/memory/time limits, and run the baseline in the same sandbox type, not in the user's repo. Repo content is untrusted, so executing its tests is arbitrary code execution.
- Cost: keep system prompt + rules + schema as a cached prefix (>= 512 tokens on 5.5-family models); batch per-file; cheap model (Haiku 5.5) for triage/classification of findings and explanation chat, Sonnet 5.5 for patch generation, Opus 5.5 / Fable 5.1 only for retry escalation on hard failures. This tiering is my inference; I found no sourced benchmark comparing these models on code repair.
- Deterministic codemods for well-known patterns (`new Buffer`, `fs.exists`, `sys.puts`) are cheaper and safer than LLM calls; reserve the LLM for ambiguous cases (e.g. `createCipher` -> `createCipheriv` needs key/IV design and changes data format, so it must be flagged as non-mechanical; the current regex rename to `createCipheriv(` without an IV produces broken code).

### Gaps
- No sourced comparison of Claude 5-family models on code-repair accuracy/cost; model-tier advice is inference only. I did not retrieve per-model price table beyond the Opus 5.5 example.
- Did not research comparable open-source tools (e.g. SWE-agent-style repair pipelines, codemod frameworks) or Anthropic's guidance on agent sandboxing; no sourced evidence for specific unified-diff validation libraries beyond the `diff` package already in use.
- Did not read `scanner.ts` line-by-line; observations are from grep (regex scanning at lines ~273, ~304 duplicates what the AST analyzer does).

## Recommended changes to the four files (comparison summary)

### Takeaway
Highest-value changes: (1) build one shared TS Program and use symbol-based detection; (2) replace regex patching with LLM-or-codemod edits that are validated against source; (3) sandbox the baseline and patched runs; (4) actually use Mastra (or drop the name).

### Cited Findings
- All items below are local observations from reading the four files plus the sources above; see sections above for citations.

### Inferences
- `ast-analyzer.ts`: per-file `createSourceFile` -> single `createProgram` over filtered roots; symbol-based matching; use `getPreEmitDiagnostics` for unresolved imports (handles `node:` prefix, package exports, tsconfig paths; current check treats bare `.`-relative only, ignores `.mjs/.cjs/.d.ts`, and `import()`/`export from` forms); scan for `@deprecated` usages via checker; add dead-code detection (unused exports via `findReferences` or `noUnusedLocals` diagnostics 6133/6196); correct ScriptKind for tsx/jsx/mjs/cjs; dedupe the six copies of line/col boilerplate into one helper; Windows-safe path handling.
- `scanner.ts`: duplicates AST work with regex (lines ~273, ~304) and a second directory walk; drive it from the single file inventory; make ignore list also honor `.gitignore`/nested `node_modules`.
- `resurrection.ts`: regex `fs.exists` replacement produces invalid code (`const exists = ...; ((cb) => {` ) and `createCipher` rename is semantically wrong; hardcoded hacks for `./missing-util` / `./legacy-helper` and the fake default package.json diff are demo-fitted and misleading; `engines: '>=20.0.0'` vs UI text "Node 22" inconsistent; `pkg.scripts.test = 'node test.js'` assumes a file exists; swallow-all `catch {}` hides failures; verification runs baseline in the real repo, inherits full env, and uses `exec` with a shell string; temp dir under hardcoded `/tmp` (use `fs.mkdtemp(os.tmpdir())`); sandbox skips node_modules so tests needing deps will fail without an install step; `exitCode` may be a string for spawn errors.
- `ghost-ai.ts`: silent fallback to canned text should be labeled or surfaced; swap Ollama call for Anthropic SDK with prompt caching of system+findings context (cached prefix; keep per-turn user message after the breakpoint); 6 s timeout too short for local models; citations are inferred by substring match on file name, so use structured output with `{reply, citations:[{file,lineStart,lineEnd}]}` and verify each citation against the evidence set.
- `mastra/index.ts`: convert to real `createStep`/`createWorkflow`, wire schemas, add `retries`, `suspend` approval gate, and register on a `Mastra` instance with observability; `checkDependenciesTool` is a 7-entry hardcoded list, consider querying the npm registry `deprecated` field / `npm audit`; sync `fs` walks and `readFileSync` of every file just to count LOC block the event loop in a Next.js server (use async or a single pass).

### Gaps
- Deprecated-API knowledge list (which Node APIs were removed in which version) was not researched against Node release notes; entries in `ast-analyzer.ts` such as "sys.puts removed" were not independently verified here.

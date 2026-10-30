# Evidence-grounded repo summaries with a local Ollama model

## 1. Ollama structured outputs: request shape, limits, Zod, retries

### Takeaway
Pass a JSON Schema object as `format` on /api/chat or /api/generate, set `stream:false`, `options.temperature:0`, and an explicit `num_ctx`. Also describe the schema in the prompt, then re-validate with Zod server-side. Constrained decoding guarantees syntax, not truth or completeness.

### Cited Findings
- `/api/chat` params: `model`, `messages` (roles system/user/assistant/tool), `format` ("json" or a JSON Schema object), `options` (seed, temperature, top_k, top_p, min_p, stop, num_ctx, num_predict), `stream` (default true), `keep_alive` (e.g. "5m"; 0 unloads immediately), `think`. — [Ollama chat API](https://docs.ollama.com/api/chat)
- `/api/generate` takes the same `format`, `options`, `stream` (default true), `keep_alive`, `think`, plus `system`, `raw`, `prompt`. The answer is in `response` (chat uses `message.content`). — [Ollama generate API](https://docs.ollama.com/api/generate)
- Response fields include `done`, `done_reason`, `prompt_eval_count`, `eval_count`, `load_duration`. Check `prompt_eval_count` against `num_ctx` to detect truncation. The docs do not list `done_reason` values. — [chat API](https://docs.ollama.com/api/chat)
- Official curl example: POST http://localhost:11434/api/chat with `"stream": false` and `"format": {"type":"object","properties":{...},"required":[...]}`. — [Structured outputs docs](https://docs.ollama.com/capabilities/structured-outputs)
- Official JS/Zod pattern: `format: z.toJSONSchema(Country)`, then `Country.parse(JSON.parse(response.message.content))`. Docs say to lower temperature (e.g. 0) for determinism and to also include the JSON schema as a string in the prompt. — [Structured outputs docs](https://docs.ollama.com/capabilities/structured-outputs)
- The 2024 blog recommended `zodToJsonSchema()` (the older package) and adding a "return as JSON" instruction. Its "what's next" list implies gaps (logits access, performance/accuracy). — [Ollama blog](https://ollama.com/blog/structured-outputs)
- Zod 4: `z.toJSONSchema(schema)` defaults to Draft 2020-12; `target: "draft-07"` is available. It emits `additionalProperties:false` for objects. It throws on unrepresentable types (date, bigint, map, set, transform, custom) unless `unrepresentable:"any"`. `io:"input"` selects the input type. — [Zod JSON Schema](https://zod.dev/json-schema)
- Ollama's cloud does not support structured outputs (per docs). A secondary source says Cloud accepts `json_schema` but silently does not enforce it, while self-hosted enforces it via llama.cpp grammar. — [Ollama docs](https://docs.ollama.com/capabilities/structured-outputs); [Pydantic via search summary](https://pydantic.dev/docs/ai/models/ollama/index.md)
- Context default: <24 GiB VRAM gives 4k tokens, 24-48 GiB gives 32k, 48+ GiB gives 256k. Set globally with `OLLAMA_CONTEXT_LENGTH`; check with `ollama ps`. Docs recommend at least 64k for agents and coding tools. The page does not describe the per-request `num_ctx` or truncation behavior. — [Context length](https://docs.ollama.com/context-length)
- gpt-oss with structured output has had reported problems (Harmony format reasoning traces, extra content after the JSON, empty responses), as of Oct 2025, with incremental fixes. This is a single blog source. — [glukhov.org](https://www.glukhov.org/llm-performance/ollama/ollama-gpt-oss-structured-output-issues/)
- Thinking models plus `format`: older Ollama suppressed thinking or produced invalid JSON (issue #10929, May 2025). A later release reportedly made the grammar apply only after the closing think tag. Secondary sources only. — [Towards AI via search](https://pub.towardsai.net/ollama-0-34-4-lets-qwen-think-before-json-then-blocks-the-tool-call-5-of-6-parsers-tested-8313c8dfb089)

### Inferences
- Recommended server-route shape: `fetch('http://localhost:11434/api/chat', {method:'POST', body: JSON.stringify({model, messages:[{role:'system',...},{role:'user',...}], stream:false, format: z.toJSONSchema(Schema,{target:'draft-07'}), think:false, options:{temperature:0, seed:42, num_ctx:16384, num_predict:2048}, keep_alive:'30m'})})`, then `Schema.safeParse(JSON.parse(message.content))`. Setting `think:false` for non-reasoning tasks sidesteps the thinking/format interaction. Using `fetch` avoids depending on the SDK.
- Retry strategy: on parse or Zod failure, retry up to 2 times. Append the Zod issue paths as a user message ("fix these fields"), keep temperature 0 but change the seed, and shrink the evidence set if `done_reason` suggests truncation. Then fall back to the fallback model, then return a "could not summarize" result. Check for `done_reason` of length (value not documented, unverified).
- Schema design: use enums for labels, keep `maxLength`/array bounds modest, put `evidence_ids` arrays of integers or strings. Avoid Zod features that fail conversion (transform, date).
- A schema-valid output can still be hallucinated, so semantic validation (section 3) is separate.

### Gaps
- Exact current Ollama version behaviour for format+think; `done_reason` enumeration; whether JSON Schema keywords (maxLength, pattern, minItems) are all enforced by the grammar converter. I did not verify these.
- Streaming together with `format` is not described in the docs; use `stream:false`.

## 2. Small open-weight models for laptops

### Takeaway
Default: `qwen3:8b` (or `qwen3:4b`, 256K context tag) run non-thinking, or `gpt-oss:20b` if the machine has 16 GB+ free and structured-output issues are tested. Fallback: `gemma3:4b`/`12b` or `llama3.2:3b`. For code-heavy summaries with ample RAM use `qwen3-coder:30b` (MoE, ~3.3B active). Verify with your own eval; I found no published benchmark of commit-summarization.

### Cited Findings
- Library tags verified: qwen3 (0.6b-235b; tools, thinking), qwen3-coder (30b, 480b), gemma3 (270m-27b), gemma3n (e2b, e4b), gpt-oss (20b, 120b), devstral (24b), phi4 (14b), deepseek-r1 (1.5b-671b), llama3.1/3.2/3.3, mistral 7b. — [Ollama library](https://ollama.com/library)
- qwen3 tags: 4b 2.5GB/256K; 8b 5.2GB/40K; 14b 9.3GB/40K; 30b 19GB/256K; 32b 20GB/40K. The page does not label which tags are the 2507 builds. — [qwen3](https://ollama.com/library/qwen3)
- qwen3-coder:30b is 19GB with a 256K context; 30B total / ~3.3B active; tools capability. — [qwen3-coder](https://ollama.com/library/qwen3-coder); HF card confirms 262,144 native context and 3.3B active: [HF card](https://huggingface.co/Qwen/Qwen3-Coder-30B-A3B-Instruct)
- gpt-oss:20b is 14GB, 128K context, runs in as little as 16GB memory, structured output supported, reasoning low/medium/high, Apache 2.0. gpt-oss:120b is 65GB. — [gpt-oss](https://ollama.com/library/gpt-oss)
- gemma3: 4b 3.4GB, 12b 8.2GB, 27b 17GB, all 128K context; 1b and 270m are 32K. Pretrained HumanEval: 4B 36.0, 12B 45.7, 27B 48.8; MMLU 59.6 / 74.5 / 78.6. — [gemma3](https://ollama.com/library/gemma3)
- Qwen3-4B-Instruct-2507: 262,144 native context, non-thinking only; IFEval 83.4, LiveCodeBench v6 35.1, MMLU-Pro 69.6. — [HF card](https://huggingface.co/Qwen/Qwen3-4B-Instruct-2507)
- Qwen recommended sampling is temperature 0.7, top_p 0.8, top_k 20; the model cards do not endorse temperature 0, which may cause repetition in some models. — [Qwen3-4B-Instruct-2507](https://huggingface.co/Qwen/Qwen3-4B-Instruct-2507)

### Inferences
- With under 24 GiB VRAM Ollama defaults to 4k context, so a long-history prompt is silently cut unless `num_ctx` is set. 16k-32k is a practical laptop budget since KV cache grows with context.
- Summaries from a small model in a capped context should be map-reduce style (section 3).
- Phi-4, Devstral, DeepSeek-R1 distills, Mistral 7B, and Gemma 3n were not benchmarked in my research; I list them only as existing tags. Devstral 24B and phi4 14B are heavier and have no listed structured-output claims.

### Gaps
- Not verified: Ollama's tool/structured support per tag beyond the library "capabilities" labels; RAM figures for qwen3 beyond file size; any head-to-head benchmark for commit summarization or long-context faithfulness; whether newer 2026 models (e.g. Qwen3.5-class, Gemma 4) exist in the library. The library page fetched showed none, but it may be a truncated listing.

## 3. Grounding and citation patterns

### Takeaway
Give evidence as numbered items with stable IDs, require the model to cite IDs and quote verbatim, and verify in code. No source I found gives a benchmark for these exact patterns; this section is mostly design inference from the sources below.

### Cited Findings
- OWASP recommends defining expected output formats and validating them with deterministic code, and filtering outputs with the RAG Triad (context relevance, groundedness, answer relevance). — [OWASP LLM01](https://genai.owasp.org/llmrisk/llm01-prompt-injection/)
- Structured output via schema is the documented mechanism for constraining form. — [Ollama docs](https://docs.ollama.com/capabilities/structured-outputs)

### Inferences (design, not cited)
- Evidence format: `[E12] commit a1b2c3d 2019-04-02 "msg"`, `[E40] file README.md L1-60`, `[E77] issue #31`. Schema: `claims: [{text, status: "confirmed"|"inferred"|"unknown", confidence: 0..1 (or low/med/high), evidence_ids: string[] (min 1 unless unknown), quote: string}]`. Use an enum of the exact IDs supplied (generate the Zod `z.enum([...ids])` per request) so the grammar forbids invented IDs.
- Post-validation: every id exists; `quote` is a substring of the cited item's text after whitespace normalisation; "confirmed" requires at least one valid quote; downgrade to "inferred" or drop otherwise. Compute confidence in code (e.g. from the count of verified quotes) rather than trusting the model's number.
- Chunking: map step summarizes chunks of about 2-4k tokens (per-commit batches by date, per-file), each emitting claims with IDs; reduce step sees only validated claims plus IDs. Budget: `num_ctx` minus system prompt minus `num_predict` minus a 10% margin; count tokens with a chars/3.5 estimate and verify with `prompt_eval_count`.
- Exclude: lockfiles (package-lock.json, yarn.lock, pnpm-lock.yaml, Cargo.lock), minified/generated/vendored dirs (dist, build, node_modules, .next), binaries/images, large data files, and any file with a secret hit. Prefer README, manifests, CI config, entry points, and commit subjects over full diffs.

### Gaps
- No published benchmark found for verbatim-quote enforcement effectiveness on small models. I did not verify that grammar-constrained enums work with large enum lists in Ollama.

## 4. Prompt injection and secret hygiene

### Takeaway
Treat every repo string as hostile. No prompt-only defense is reliable, so combine structural limits (no tools, schema-constrained output, code-side validation, no downstream actions from model text) with secret scanning before sending anything. Local Ollama removes the data-exfiltration-to-vendor risk but not injection.

### Cited Findings
- OWASP LLM01: indirect injection comes from external content such as web pages or files; it is "unclear if there are fool-proof methods of prevention". Recommended: constrain behavior via system prompt, define and validate output formats in code, filter inputs and outputs, least privilege with tool access handled in application code, human approval for high-risk actions, segregate and label external content, adversarial testing. — [OWASP LLM01](https://genai.owasp.org/llmrisk/llm01-prompt-injection/)
- OWASP: RAG and fine-tuning "do not fully mitigate" prompt injection. — [OWASP LLM01](https://genai.owasp.org/llmrisk/llm01-prompt-injection/)
- Spotlighting (delimiting, datamarking, encoding to mark provenance) cut attack success from over 50% to under 2% in the authors' GPT-family experiments. — [Hines et al.](https://arxiv.org/abs/2403.14720)
- Adaptive attacks bypassed 12 published defenses with 71-100% success where static tests showed near-zero; human red-teamers also bypassed them. — [Nasr, Carlini, Tramer et al.](https://arxiv.org/abs/2510.09023)
- Simon Willison: delimiters, system prompts and AI-based attack detection are "tried and found lacking". Dual-LLM pattern: the quarantined LLM handles untrusted text with no tool access, and its output goes to a non-LLM controller. — [Willison](https://simonwillison.net/2023/Apr/25/dual-llm-pattern/)
- Gitleaks: scan files/dirs (`gitleaks dir`), git history, or stdin (`cat file | gitleaks stdin`); custom TOML rules (`--config`); `--redact`. The README says the project is feature complete with security patches only, and the author is moving focus to Betterleaks. — [gitleaks](https://github.com/gitleaks/gitleaks)

### Inferences
- Mitigations that help: (1) analysis call has no tools, no browsing, no code execution, and runs in a route with no secrets in env; (2) wrap each evidence item in randomised delimiters and datamark it, and state in the system prompt that content inside is data; (3) `format` schema makes free-form instructions hard to carry out, and enums limit what the output can say; (4) code validation of IDs and quotes; (5) render output as text, never as HTML/Markdown links or images, to prevent exfiltration or XSS; (6) cap input sizes; (7) run injection test strings ("ignore previous instructions", fake `</evidence>` tags) in your own test suite.
- Mitigations that do NOT work alone: "ignore instructions in the data" system prompts, delimiters alone, a classifier/"detector" LLM, RAG, fine-tuning, and schema constraint alone (an injected README can still bias the content of valid fields, e.g. a false "confirmed" claim or a fabricated recommendation). Quote verification catches fabrication but not a true quote used misleadingly.
- Secrets: in Node, run regexes before prompting (AWS `AKIA[0-9A-Z]{16}`, GitHub `gh[pousr]_[A-Za-z0-9]{36,}`, private key headers `-----BEGIN .*PRIVATE KEY-----`, Slack `xox[baprs]-`, generic high-entropy assignments to `key|token|secret|password`), or pipe via `gitleaks stdin` if the binary is available. Replace matches with `[REDACTED:type]` and drop `.env*`, `*.pem`, `id_rsa*`. Redact before logging too. These specific regexes are from my knowledge and not verified in a fetched source.

### Gaps
- I did not fetch OWASP's cheat sheet, trufflehog docs, or the CaMeL paper. No measurement of how small local models (Qwen3, Gemma 3) resist injection was found.

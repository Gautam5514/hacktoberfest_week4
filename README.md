# THE LAST COMMIT_

> **Dead Code Deserves a Second Life.**  
> An open-source AI-powered resurrection lab for forgotten software · Hacktoberfest 2026 Week 4 DevChallenge.

---

## 1. What is The Last Commit?

Every day, thousands of open-source repositories are abandoned. Node.js versions advance, native bindings break (LibSass/Node-Sass), constructors are deprecated (`new Buffer()`), and relative imports silently rot.

**The Last Commit** is an open-source, local-first developer tool that resurrects dead codebases using **Gemma 3** (via Ollama) orchestrated through structured TypeScript workflows.

The application answers five concrete questions about any supported repository:
1. **Purpose:** What was this software originally designed to do?
2. **Autopsy:** Why did it break?
3. **Salvage:** Which parts can still be reused?
4. **Repair:** What minimal, safe changes will revive it?
5. **Empirical Proof:** Can we verify that the repair actually works with real tests?

---

## 2. Brand & Visual Direction

The platform features a dark developer workspace with a subtle Halloween / laboratory identity:

| Token | Hex | Role |
| :--- | :--- | :--- |
| **Void** | `#090B0A` | Deepest background canvas |
| **Panel** | `#151A17` | Elevated workstation panels |
| **Border** | `#28352D` | Structural borders |
| **Life** | `#A4F4B8` | Ghostly emerald glow, verified states |
| **Pumpkin** | `#FF9F43` | Deprecations & high severity alerts |
| **Crimson** | `#FF5E57` | Critical failures & death cause |
| **Text** | `#E8EDE9` | Interface typography (Geist Sans & Mono) |

---

## 3. System Architecture

```
┌────────────────────────────────────────────────────────┐
│                   Next.js App Router                   │
│   Dashboard · Graveyard · Autopsy · Ghost Chat · Diff  │
└───────────────────────────┬────────────────────────────┘
                            │
┌───────────────────────────▼────────────────────────────┐
│              Deterministic Code Scanner                │
│   Package.json · Engines · Deprecated APIs · Imports   │
└───────────────────────────┬────────────────────────────┘
                            │
┌───────────────────────────▼────────────────────────────┐
│                   Mastra Agent Layer                   │
│         The Ghost Persona & Structured Prompts         │
└───────────────────────────┬────────────────────────────┘
                            │
┌───────────────────────────▼────────────────────────────┐
│                   Ollama + Gemma 3                     │
│         On-Device Local Inference (3.4 GB)             │
└───────────────────────────┬────────────────────────────┘
                            │
┌───────────────────────────▼────────────────────────────┐
│              Isolated Sandbox Verification             │
│       Before vs. After Real Test Execution Proof       │
└────────────────────────────────────────────────────────┘
```

---

## 4. Key Screens & Workflows

1. **`/` (Landing & Specimen Importer):** Paste any public GitHub URL or local repository path. Includes one-click graveyard presets.
2. **`/graveyard` (Memorial Catalog):** Digital tombstones for historical codebases, tracking cause of death, year died, and revival status.
3. **`/lab/[id]` (Specimen Telemetry):** Health score dial (0–100), runtime delta (e.g. Node 8-14 &rarr; Node 22 LTS), and reusable module counts.
4. **`/lab/[id]/autopsy` (Findings & Evidence):** Categorized flaws (compatibility, runtime, dependencies, security, tests) with exact line citations and verified evidence snippets.
5. **`/lab/[id]/ghost` (The Ghost AI):** Interactive on-device assistant grounded in the codebase AST, strictly citing files without fabricating facts.
6. **`/lab/[id]/resurrection` (Diff Workbench & Sandbox):** Review proposed unified patches side-by-side, approve fixes, and run isolated sandbox verification showing before (exit code 1) vs. after (exit code 0).
7. **`/lab/[id]/report` (Recovery Report):** Exportable audit certificate with executive summaries, findings table, markdown copy, and JSON export.
8. **`/settings` (Inference Control):** Ollama daemon connection monitor, model picker (`gemma3:4b`), and on-device privacy guarantee.

---

## 5. Sample Fixtures & Verification

The repository includes two test specimens:
- `examples/broken-js-app`: Realistic 2016 specimen containing an outdated `engines.node` specification, deprecated `request` dependency, insecure `new Buffer()` call, and broken `./missing-util` import. Running `node test.js` fails with exit code 1.
- `examples/repaired-js-app`: Modernized specimen running cleanly on Node 22 LTS with `Buffer.from()`, resolved helper, and passing assertions (`✓ All 4 resurrection tests passed!`).

### Automated Test Runner
```bash
npm run test:sample
```

---

## 6. Quick Start

### Prerequisites
- Node.js 20+ or Node.js 22 LTS
- Ollama (optional for pure local inference):
  ```bash
  ollama pull gemma3:4b
  ollama run gemma3:4b
  ```

### Installation & Launch
```bash
# 1. Install dependencies
npm install

# 2. Run automated resurrection test suite
npm run test:sample

# 3. Start development server
npm run dev

# 4. Open in browser
open http://localhost:3000
```

---

## 7. Open Innovation & Security Non-Negotiables

- **Untrusted Code Isolation:** Repositories are treated as untrusted data. No lifecycle scripts (`postinstall`) are ever automatically executed.
- **Rootless & Disposable Sandboxing:** Verification tests run in isolated, temporary directories with strict timeouts.
- **100% On-Device Privacy:** Code is inspected and reasoned through on your local machine via Gemma 3 and Ollama. No proprietary cloud API keys required.

---

## 8. License

MIT License © 2026 The Last Commit Contributors.
Open weights governed by Google Gemma Terms of Use.

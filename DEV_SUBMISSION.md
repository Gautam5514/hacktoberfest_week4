*This is a submission for the [Hacktoberfest Open-Source AI Challenge Week 4: Ghost in the Machine](https://dev.to/challenges/hacktoberfest-week4-2026-10-26).*

A repository doesn't need a ghost to become haunted. Sometimes all it takes is a missing import, an obsolete dependency, and a README nobody has touched in ten years.

**The Last Commit** is a recovery lab for that software. Its premise is simple: **dead code deserves a second life—and a passing test should be the evidence.**

## What I Built

The Last Commit helps developers inspect forgotten JavaScript and TypeScript projects, understand what broke, review focused repairs, and compare test results before and after a patch.

The Halloween metaphor follows the actual workflow:

- **The graveyard:** a catalog of dormant specimens.
- **The autopsy:** findings about deprecated APIs, broken imports, dependencies, and runtime assumptions.
- **The Ghost:** a repository assistant that sends supplied findings and file context to Gemma 3 through Ollama.
- **The resurrection:** reviewable unified diffs and before/after test execution.
- **The recovery report:** an exportable record of findings and verification.

The theme is also about remembering the work inside old software. A broken build doesn't erase the useful idea underneath it.

## Demo

**[Open The Last Commit](https://hacktoberfestweek4.vercel.app/)** · **[Open the guided demo](https://hacktoberfestweek4.vercel.app/demo)**

The public site is the hosted interface. For the complete filesystem and local-model workflow, run the repository locally: a Vercel server cannot access Ollama running on a visitor's laptop. The hosted preview should not be treated as proof of live Gemma inference.

### A judge's walkthrough

1. Open the guided demo and choose **Resurrect the broken app**. It imports the bundled `examples/broken-js-app` specimen.
2. Follow **Scan → Autopsy → Repair → Prove**. Inspect the findings and the proposed diff.
3. Compare the before/after logs and exit codes. A successful repair should be backed by the test result.
4. Open the full autopsy, ask the Ghost why the project broke, and export the recovery report.

For a reproducible local check:

```bash
git clone https://github.com/Gautam5514/hacktoberfest_week4.git
cd hacktoberfest_week4
npm install
npm run test:sample
npm run dev
```

For Gemma-powered answers, install Ollama, start its daemon, and download the model:

```bash
ollama pull gemma3:4b
```

Open `http://localhost:3000/settings` to check the model connection, then use the lab's Ghost view. Once the model and dependencies are downloaded, analysis of a local repository can stay on the same machine. Importing a remote GitHub repository still needs network access.

### What I verified

The included sample verification script produced these results:

| Check | Result |
| --- | --- |
| Broken fixture | Expected failure, exit code 1 |
| Repaired fixture | All four resurrection assertions passed |
| Core routes and implementation files | All 12 expected files present |

This checks the bundled fixtures and project structure. It is not a claim that arbitrary repositories can be repaired automatically, or that a live model was exercised by that script.

## Code

**[Source repository](https://github.com/Gautam5514/hacktoberfest_week4)**

The application uses Next.js 14, React, TypeScript, Tailwind CSS, the `diff` package, and Ollama's chat API with `gemma3:4b`.

The most useful places to inspect are:

- [Static scanner](https://github.com/Gautam5514/hacktoberfest_week4/blob/main/src/lib/scanner.ts)
- [Ghost model integration](https://github.com/Gautam5514/hacktoberfest_week4/blob/main/src/lib/ghost-ai.ts)
- [Patch generation and verification](https://github.com/Gautam5514/hacktoberfest_week4/blob/main/src/lib/resurrection.ts)
- [Evidence verification for GitHub analysis](https://github.com/Gautam5514/hacktoberfest_week4/blob/main/src/lib/github/ai.ts)

## How I Built It

### 1. Start with evidence

The scanner checks manifests, selected deprecated dependencies, known API patterns, and relative imports. Findings include file references and evidence snippets.

This creates a useful boundary: the model explains supplied evidence; it doesn't need to invent the initial diagnosis.

### 2. Give the repository a voice with Gemma

The Ghost builds a prompt from the repository's architecture summary, indexed files, findings, and recent messages. It calls Ollama's `/api/chat` endpoint with `gemma3:4b` and a low temperature.

Its system instructions tell it to treat repository content as untrusted data, separate hypotheses from verified facts, cite relevant files, and avoid claiming it ran tests.

Those instructions reduce risk; they do not guarantee factual answers. In the GitHub analysis pipeline, a separate verifier checks quoted text against the cited evidence and downgrades unsupported claims.

If Ollama is unavailable, the Ghost returns deterministic, finding-based responses. **That fallback is not model inference.** The scanner and fixture demo can work without the model, while open-weight Gemma provides the conversational interpretation when connected.

### 3. Keep repairs small enough to inspect

Current patch generation is rule-based. It handles selected transformations such as replacing `new Buffer(...)` with `Buffer.from(...)`, updating runtime metadata, and repairing the bundled fixture's known missing-helper pattern.

It deliberately leaves changes such as obsolete crypto APIs for manual review because those need semantic decisions. A patch that works for the sample is not a general migration strategy.

The orchestration is implemented in TypeScript. Although an internal workflow class uses the name Mastra, the project does not currently depend on the Mastra SDK.

### 4. Ask the tests

Verification copies the repository to a temporary directory, records a baseline run, applies the proposed files, and runs the verification command again.

The result includes logs and exit codes. This makes the outcome inspectable instead of relying on an assistant saying “fixed.”

**Current limitation:** a temporary directory and timeout are not a security isolation boundary. Test commands execute as subprocesses on the host, so this prototype's verification should be used with trusted specimens. Hardened container isolation is future work.

## Why Does Open Innovation Matter?

A tool for preserving software should itself be possible to keep running.

Gemma's open weights and Ollama's local runtime let the recovery assistant operate without sending its model prompts to a proprietary cloud inference service. In a local deployment, that gives developers control over the code context they share with the model.

It also makes the model replaceable. Developers can inspect the prompts, change the endpoint or model configuration, and adapt the workflow to their hardware. Gemma is open-weight under its own terms; that is distinct from the application's source licensing.

The tradeoff is real: local inference needs memory, a downloaded model, and a running daemon. I chose that tradeoff because old software deserves a recovery path that isn't tied to one hosted AI service staying available.

## The Spirit of It

The moment this project is built around is small: a terminal moves from a failing test to a passing one.

That doesn't prove an entire abandoned system is healthy. It gives a developer a concrete starting point—and a reason to keep investigating.

In **Ghost in the Machine**, the ghost is the intent left behind in the repository. The lab helps someone find it again.

## Prize Categories

**Best Use of Gemma:** Gemma 3 through Ollama powers the local repository assistant, interpreting scanner findings and file context. The reproducible local setup above shows how to exercise that integration.

*AI assistance was used to develop and prepare this submission, including the cover illustration and editorial work. Implementation details and limitations are described explicitly above.*

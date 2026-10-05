# Agent Workflow Lab

A serious-looking, local-first AI workflow playground for composing prompt, transform, retrieval, tool, and evaluator nodes. It is intentionally dependency-free so the workflow engine is inspectable and can run from a static file.

## What it demonstrates

- Visual node graph with position-derived execution order
- Draft, validate, run, duplicate, and reset workflows
- Deterministic local execution with step-by-step trace logs
- Prompt templates with `{{input}}` and `{{context}}` variables
- JSON import/export for workflow portability
- Version labels for duplicated drafts
- Run history, latency, pass rate, and status badges
- Per-evaluator pass/fail log for the most recent run
- Keyboard-operable node selection and removal, and a responsive layout

## Run

Open `index.html` in a modern browser. No build step, dependency, server, network request, API key, or account is needed.

## Tests

The deterministic engine lives in `workflow-core.js`, which the page loads as a classic script and the tests `require` directly. No bundler or dependencies are involved.

```bash
node tests/index.test.js
# or
npm test
```

## Architecture

The graph is represented as JSON: nodes contain a type, configuration, and canvas position. The runtime evaluates nodes from left to right by their `x` position and renders matching visual connectors. This keeps the execution model deterministic and easy to inspect. The pure engine lives in `workflow-core.js`; `index.html` handles rendering and events.

- **Input** normalizes the run payload.
- **Prompt** interpolates `{{input}}` and `{{context}}` into the rendered prompt.
- **Transform** applies operations such as uppercase, summarize, or JSON shaping.
- **Retriever** selects context from the local notes panel using token overlap, and that selection becomes the `{{context}}` used by Prompt nodes. A retriever still feeds the prompt when it sits to the right of it on the canvas; a graph with no retriever falls back to the raw notes.
- **Tool** performs a safe built-in operation such as word counting or timestamping.
- **Evaluator** checks that the output contains an expected phrase.
- **Output** publishes the final result.

A run passes only when it has at least one evaluator node and every evaluator passed. Runs with no evaluator report `NO CHECKS` and are excluded from the pass rate.

### Keyboard use

Each node is focusable. `Enter` or `Space` selects a node for the Inspector, and `Delete` removes the focused node. The trace, output, evaluation log, and run history announce their updates to assistive technology.

## Security and privacy

The static demo does not make network requests and never submits provider keys. Imported notes are rendered with text nodes. Workflow JSON is size-limited during import, node execution is allow-listed by type, and imported config values are coerced to strings so a malformed graph cannot throw mid-run.

## License

MIT © 2026 无聊玩玩 (hzh6767).

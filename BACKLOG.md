# nodepad Project Backlog

## 📋 Open Issues

### [#001] AI Returned Unparseable JSON
- **Status**: `Open` | **Priority**: `P1` | **Labels**: `Stability`, `Bug`
- **Created**: 2026-04-10
- **Description**: Models (especially larger ones like Qwen 3.5) occasionally return the JSON schema definition or a malformed object instead of just the values.
- **Example**: `Raw: {"type":"object","properties":{...}}` instead of the expected result object.
- **Root Cause**: The system prompt instructions for `json_object` mode are being misinterpreted by some models as a request to echo the schema.

### [#002] Empty AI Response / Timeout
- **Status**: `Open` | **Priority**: `P1` | **Labels**: `Reliability`, `Bug`
- **Created**: 2026-04-10
- **Description**: When RAG is enabled, the total request time can exceed 60-90 seconds, causing the connection to drop or the cloud provider to return an empty body.
- **Proposed Fix**: Implement an auto-retry logic in `enrichBlockClient` or move the timeout handling to the server-side proxy.

### [#003] Search Query Distillation
- **Status**: `Open` | **Priority**: `P2` | **Labels**: `RAG`, `Feature`
- **Created**: 2026-04-10
- **Description**: Currently, the entire `userMessage` (including XML tags and page context) is sent to the search engine.
- **Proposed Fix**: Use a fast model to distill the note text into 1-3 crisp search queries before calling `/api/web_search`.

### [#004] Hydration Mismatch Suppression
- **Status**: `Open` | **Priority**: `P3` | **Labels**: `UI`, `Tech-Debt`
- **Created**: 2026-04-10
- **Description**: Browser extensions injecting attributes (like `fdprocessedid`) cause React hydration warnings in the console.
- **Proposed Fix**: Add `suppressHydrationWarning` to the main input component.

### [#012] Multi-modal Support (Visual Anchors & Reasoning)
- **Status**: `Open` | **Priority**: `P1` | **Labels**: `Feature`, `Multi-modal`
- **Created**: 2026-04-12
- **Description**: Enable the AI to process images and videos alongside text notes. This transforms nodepad into a perceptual extension, allowing for visual anchors in spatial memory, OCR for handouts/math, and vision-based reasoning (e.g., analyzing D&D maps or physics diagrams).

### [#013] IndexedDB Media Persistence
- **Status**: `Open` | **Priority**: `P2` | **Labels**: `Architecture`, `Storage`
- **Created**: 2026-04-12
- **Description**: Transition from `localStorage` to `IndexedDB` for storing large media assets (images/videos). This is necessary to avoid hitting the 5MB browser storage limit when implementing multi-modal support.

### [#014] Canvas Query Engine (Contextual Synthesis)
- **Status**: `Open` | **Priority**: `P1` | **Labels**: `Feature`, `UX`, `AI`
- **Created**: 2026-04-12
- **Description**: A top-down synthesis engine that allows users to query their entire workspace (all 100+ nodes) rather than just recent context.
- **Proposed Implementation**:
    - **Command-Based**: Use `/ask` or `/draft` in the command bar to trigger operations.
    - **Query Panel**: A dedicated sidebar (extending the Synthesis Panel) for long-form responses, outlines, and summaries.
    - **Spatial Grounding**: Interactive citations in AI output that dim the canvas and highlight the specific source nodes when hovered/clicked.
    - **Note Conversion**: "Pin to Canvas" button to turn an AI response into a permanent #thesis node.
- **Design Philosophy**: Must avoid the "Chatbot" anti-pattern. The AI remains a partner that operates on the spatial map, not a conversational agent.
- **Open Question**: Should a spatial canvas do more than just pin notes? Is a "query" function the right path, or should the AI interact more directly with the spatial arrangement (e.g., semantic clustering or "lenses" as an answer)?

### [#015] UI-Mutating Natural Language Commands
- **Status**: `Open` | **Priority**: `P3` | **Labels**: `UX`, `Core`
- **Created**: 2026-04-12
- **Description**: Allow the AI to interact with the UI via natural language commands (e.g., "Highlight all notes related to Thermodynamics" or "Group all task nodes in the top right"). This reduces the manual labor of organizing large canvases.

---

## ✅ Completed / Archived

### [#020] Node.js Deprecation Warning (DEP0190) Fix
- **Status**: `Closed` | **Resolved**: 2026-05-07
- **Labels**: `Security`, `Tech-Debt`, `Windows`
- **Summary**: Resolved the Node.js deprecation warning (DEP0190) related to spawning child processes with `shell: true` and multiple arguments.
- **Technical Highlights**:
    - **Safe Command Construction**: Implemented manual escaping and quoting for CLI arguments.
    - **Single-String Spawning**: Refactored `spawn` calls to pass a single command string, satisfying Node.js 22+ security requirements while maintaining Windows compatibility for `.ps1` scripts.

### [#021] Gemini CLI UI & Configuration Polishing
- **Status**: `Closed` | **Resolved**: 2026-05-07
- **Labels**: `UI`, `UX`, `Gemini-CLI`
- **Summary**: Improved the UI integration and configuration model for the Gemini CLI provider.
- **Technical Highlights**:
    - **Model Label Visibility**: Fixed a bug where the model name was hidden in the status bar due to the absence of an API key.
    - **Gemini Auto Selection**: Simplified the configuration to a single "Gemini Auto" model, reflecting the CLI's internal model optimization.
    - **Consistency**: Ensured "Gemini Auto" is correctly reflected in both the Settings panel and the Status Bar.

### [#005] Unified Ollama Provider Support (Cloud + Local)
- **Status**: `Closed` | **Resolved**: 2026-04-10
- **Labels**: `Core`, `Feature`, `Architecture`
- **Summary**: Integrated Ollama as a hybrid provider. Implemented intelligent routing that automatically detects if a model is Local or Cloud (via `remote_host` metadata) and routes requests to the correct host (`ollama.com` vs `localhost`) dynamically.

### [#006] Server-Side AI Proxy & Dynamic Discovery
- **Status**: `Closed` | **Resolved**: 2026-04-10
- **Labels**: `Architecture`, `Security`, `API`
- **Summary**: Built `app/api/ai/route.ts` with dual functionality: a `GET` handler for dynamic model discovery (zero-config) and a `POST` handler to bypass browser CSP/CORS blocks. Implemented discovery persistence via `localStorage` to ensure dynamic metadata is available to core application logic.

### [#007] Hybrid Web Grounding (Ollama + Local RAG)
- **Status**: `Closed` | **Resolved**: 2026-04-10
- **Labels**: `RAG`, `Feature`
- **Summary**: Built a hybrid RAG pipeline: Live search via Ollama Cloud API -> Local vectorization via `embeddinggemma` -> Cloud-based response generation.

### [#008] Batch Embedding Performance Optimization
- **Status**: `Closed` | **Resolved**: 2026-04-10
- **Labels**: `Performance`, `Optimization`
- **Summary**: Switched from sequential embedding calls to Batch Embedding via `/api/embed`, reducing RAG processing time by over 60%.

### [#009] RAG Diagnostic Logging & Metrics
- **Status**: `Closed` | **Resolved**: 2026-04-10
- **Labels**: `DX`, `Logging`
- **Summary**: Added structured terminal logs with nanosecond-precision timing (extracted from Ollama `total_duration`) to track internal model time vs. wall-clock overhead.  

### [#010] Web Grounding UI & Dependency Check
- **Status**: `Closed` | **Resolved**: 2026-04-10
- **Labels**: `UI`, `UX`, `Safety`
- **Summary**: Integrated the RAG toggle for Ollama with a model dependency check. If `embeddinggemma` is missing locally, the toggle is disabled with a prompt to run `ollama pull embeddinggemma`. Improved UI by removing redundant model icons and adding a loading state for discovery.

### [#011] Proxy Security Hardening (Security Merge)
- **Status**: `Closed` | **Resolved**: 2026-04-11
- **Labels**: `Security`, `Architecture`
- **Summary**: Merged security best practices from community PRs (#16, #20). Implemented an **Auth Guard** (stripping keys for localhost), **SSRF Protection** (port/protocol allowlisting), and **Same-Origin Enforcement**. Fixed a 403 error in discovery by standardizing the same-origin validation logic.

### [#017] Provider Selection Race Condition (Ollama Reverting)
- **Status**: `Closed` | **Resolved**: 2026-05-06
- **Labels**: `Bug`, `UI`, `UX`
- **Summary**: Fixed a race condition in the settings sidebar where background Ollama model discovery would overwrite the user's active provider selection. Modified `ProjectSidebar.tsx` to only synchronize the local draft state when the settings panel is first opened.

### [#018] Gemini CLI Provider Integration (Premium Local Models)
- **Status**: `Closed` | **Resolved**: 2026-05-06
- **Labels**: `Core`, `Feature`, `Architecture`
- **Summary**: Integrated Gemini CLI as a premium AI provider, enabling access to Gemini 3 Pro and Flash models without external API keys.
- **Technical Highlights**:
    - **Stdin Piping**: Bypassed Windows shell character limits by streaming high-context prompts directly to `stdin`.
    - **Pure LLM Mode**: Optimized for performance and capacity by disabling agentic behavior via the `--policy simple` flag.
    - **Structured Output**: Implemented robust JSON extraction from CLI response wrappers.
    - **UI Enhancements**: Added automated keyless authentication UI logic and real-time terminal logging.

### [#019] Gemini CLI Native Web-Grounding
- **Status**: `Closed` | **Resolved**: 2026-05-06
- **Labels**: `RAG`, `Feature`, `Automation`
- **Summary**: Implemented a context-aware, two-stage web-grounding pipeline leveraging Gemini CLI's native tool-use capabilities (`google_web_search`, `web_fetch`).
- **Technical Highlights**:
    - **Autonomous Two-Stage Pipeline**:
        - **Stage 1 (Research)**: Uses the model's native agentic tools with the full nodespace context to perform deep research and synthesize a factual report.
        - **Stage 2 (Enrichment)**: Injects the research into the prompt as verified context and generates the final structured JSON using a restricted `simple` policy.       
    - **Model Autonomy**: Removed explicit model selection flags, allowing the CLI to optimize between Pro and Flash models based on capacity.
    - **High-Signal Logging**: Implemented JSON parsing of CLI stats to provide clean, Ollama-style terminal logs for tool usage.
    - **Robust Windows Handling**: Increased timeouts to 8 minutes and implemented non-blocking cleanup to prevent `EBUSY` resource locks.
    - **UI Integration**: Added a dedicated web-grounding toggle and descriptive feedback in the sidebar settings.

### [#022] Obsidian Plugin — Core Infrastructure
- **Status**: `Closed` | **Resolved**: 2026-05-11
- **Labels**: `Feature`, `Obsidian`, `Architecture`
- **Summary**: Ported the nodepad React UI into Obsidian as a first-class plugin using the `TextFileView` API. `.nodepad` files live directly in the vault and auto-save on every state change. All three view modes (Tiling, Kanban, Graph) render inside an Obsidian leaf, themed via Obsidian's own CSS variables.
- **Technical Highlights**:
    - `plugin/src/main.ts` — registers `.nodepad` extension, ribbon icon, command palette entry, folder right-click menu
    - `plugin/src/view.tsx` — mounts React into the Obsidian leaf, reads/writes vault file via `requestSave()`
    - `plugin/src/styles.css` — maps Tailwind tokens to Obsidian CSS variables; SVG and button `!important` overrides for Obsidian CSS cascade conflicts
    - `plugin/esbuild.config.mjs` — CJS bundle of all shared `lib/` and `components/` from the local fork via path aliases
    - Component patches — `isPlugin` mode in `VimInput` (hides Projects nav), portal scoping in `StatusBar`, `AboutPanel`, `Sheet`; transparent SVG `<rect>` fix for graph pan/zoom; minimap inline padding override

### [#023] Obsidian Plugin — Obsidian Settings UI
- **Status**: `Closed` | **Resolved**: 2026-05-11
- **Labels**: `Feature`, `Obsidian`, `UX`
- **Summary**: Implemented an in-Obsidian settings tab (Settings → Nodepad) for all five AI providers. Settings stored in `.obsidian/plugins/nodepad/data.json`, local to the vault.
- **Technical Highlights**:
    - Provider dropdown (OpenRouter, OpenAI, Z.ai, Ollama, Gemini CLI) with per-provider key persistence via `providerKeys` record
    - API key field with eye icon toggle (hidden for keyless providers); Ollama model auto-discovery on switch
    - Web-grounding toggle with provider-specific descriptions for all applicable providers

### [#024] Obsidian Plugin — CLI Provider Bridge (`child_process`)
- **Status**: `Closed` | **Resolved**: 2026-05-11
- **Labels**: `Feature`, `Obsidian`, `Architecture`
- **Summary**: Generic `spawnCLI()` subprocess helper in `plugin/src/ai-adapter.ts` that enables CLI tools (Gemini CLI, future Claude Code) to be invoked directly from Obsidian's Electron environment.
- **Technical Highlights**:
    - Stdin piping for high-context prompts (bypasses Windows argument length limits)
    - JSON wrapper extraction from CLI response formats
    - 8-minute timeout with non-blocking cleanup to prevent `EBUSY` resource locks on Windows

### [#025] Obsidian Plugin — Ollama Provider Support
- **Status**: `Closed` | **Resolved**: 2026-05-11
- **Labels**: `Feature`, `Obsidian`, `Ollama`
- **Summary**: Enabled Ollama (local and Cloud) with Hybrid RAG in the Obsidian plugin. `requestUrl()` in Obsidian's Electron bypasses CORS, so local Ollama works directly without a proxy.
- **Technical Highlights**:
    - Local vs Cloud routing; dynamic model discovery via `/api/tags`
    - Hybrid RAG pipeline (web search → `embeddinggemma` vectorization → cosine similarity → top-5 injection) ported from web app server route to plugin adapter
    - `getProviderHeaders()` for correct `Authorization` handling per routing mode

### [#026] Obsidian Plugin — Gemini CLI Provider Support
- **Status**: `Closed` | **Resolved**: 2026-05-11
- **Labels**: `Feature`, `Obsidian`, `Gemini-CLI`
- **Summary**: Enabled Gemini CLI as a provider inside Obsidian via the `child_process` bridge. Web grounding runs natively inside the CLI (no separate RAG pass needed).
- **Technical Highlights**:
    - Two-stage pipeline (Stage 1: agentic web research; Stage 2: `--policy simple` structured JSON enrichment)
    - Keyless auth detection in settings UI; graceful error if `gemini` binary not on PATH
    - JSON stats parsing for Ollama-style terminal logs (tool usage, model selection)

### [#016] TypeError in TileCard (icon of undefined)
- **Status**: `Closed` | **Resolved**: 2026-05-03
- **Labels**: `Bug`, `Stability`, `UI`
- **Summary**: Fixed a runtime crash where `TileCard` and other UI components failed when encountering unknown content types hallucinated by the LLM. Implemented `getSafeContentTypeConfig` and added input validation.

---

## 🔭 Upcoming Features

### [#027] Obsidian Plugin — Synthesis Document Generation
- **Status**: `Open` | **Priority**: `P2` | **Labels**: `Feature`, `Obsidian`, `AI`
- **Created**: 2026-05-11
- **Design spec**: [`docs/synthesis-document-plan.md`](docs/synthesis-document-plan.md)
- **Description**: On-demand command ("Generate Synthesis Document") that consolidates enriched nodes from a `.nodepad` canvas into a structured, contextualized Obsidian markdown document. Unlike the raw markdown export which dumps nodes grouped by type, this pipeline expands sparse notes into self-contained statements, clusters them into coherent thematic sections by meaning, and adds expounding prompts that push thinking into adjacent territory the notes don't cover. Acts as the bridge from nodepad's raw idea staging area into Obsidian's permanent knowledge graph.
- **Pipeline**:
    - **Phase 0** (human): User adds a `reference`/`entity` node naming the source material. No code needed.
    - **Phase 1** (no AI): Build edge map from `influencedByIndices` graph; detect source anchor nodes.
    - **Phase 2a + 2b** (parallel AI calls): Decontextualize each node into a self-contained statement (Call A) while simultaneously clustering nodes into named sections (Call B).
    - **Phase 2c** (sequential AI call): Merge A + B results; generate section intros, expounding prompts, gap markers, and overall summary.
    - **Phase 3** (no AI): Render to Obsidian-native markdown, inject `[[wikilinks]]`, write to vault.
    - **Phase 4** (human + external tools): User reviews output against source material via Claude Code, Gemini CLI, or NotebookLM. No code needed.
- **New files**:
    - `plugin/src/synthesis.ts` — pipeline orchestration
    - `lib/synthesis-export.ts` — Phase 3 markdown renderer
- **Modified files**:
    - `plugin/src/main.ts` — register command
    - `plugin/src/view.tsx` — expose `generateSynthesisDocument()` on the view
    - `plugin/src/ai-adapter.ts` — add `callDecontextualize`, `callCluster`, `callSynthesize`

### [#028] Obsidian Plugin — Human-in-the-Loop Review (Phase 4)
- **Status**: `Open` | **Priority**: `P3` | **Labels**: `Feature`, `Obsidian`, `UX`
- **Created**: 2026-05-11
- **Description**: Phase 4 of the Synthesis Document pipeline — reviewing the generated document against the source material and making corrections. This requires no plugin code: the output is a standard Obsidian markdown file that any AI tool with vault access (Claude Code, Gemini CLI, NotebookLM) can read, annotate, and help correct. The review process itself is pedagogically valuable — identifying and correcting AI errors demonstrates understanding of the source material. If a built-in review UI is later desired (diff view, section toggles), it can be added as a separate issue.

---

## 🔭 Future Features (Not This Session)

### [#029] Claude Code AI Provider
- **Status**: `Planned` | **Priority**: `P2` | **Labels**: `Feature`, `AI`, `Claude-Code`
- **Created**: 2026-05-11
- **Description**: Integrate the `claude` CLI (Claude Code) as a local AI provider for both the web app and the Obsidian plugin. Claude Code authenticates via local account credentials — no API key required. Uses the same `child_process` bridge established in #024 for the plugin, and the existing `/api/ai` server route for the web app.
- **Scope**:
    - `claude --print "<prompt>" --output-format json` for non-interactive enrichment
    - Web grounding via Claude Code's built-in web access (`--allowedTools web_search`)
    - Settings UI: no API key field; binary detection and auth status indicator
    - Shared `child_process` helper reused from Gemini CLI implementation (#024)
- **Prerequisite**: #024 (CLI Provider Bridge) must be complete first.
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

### [#016] TypeError in TileCard (icon of undefined)
- **Status**: `Closed` | **Resolved**: 2026-05-03
- **Labels**: `Bug`, `Stability`, `UI`
- **Summary**: Fixed a runtime crash where `TileCard` and other UI components failed when encountering unknown content types hallucinated by the LLM. Implemented `getSafeContentTypeConfig` and added input validation.

---

## 🔭 Upcoming Features

### [#022] Obsidian Plugin — Core Infrastructure
- **Status**: `In Progress` | **Priority**: `P1` | **Labels**: `Feature`, `Obsidian`, `Architecture`
- **Created**: 2026-05-11
- **Description**: Port the nodepad React UI into Obsidian as a first-class plugin using the `TextFileView` API. `.nodepad` files live directly in the vault and auto-save on every state change — no manual export step. Renders all three view modes (Tiling, Kanban, Graph) inside an Obsidian leaf, themed via Obsidian's own CSS variables.
- **Scope**:
    - `plugin/src/main.ts` — registers `.nodepad` extension, ribbon icon, command palette entry
    - `plugin/src/view.tsx` — mounts React into the Obsidian leaf, reads/writes vault file via `requestSave()`
    - `plugin/src/styles.css` — maps Tailwind tokens to Obsidian CSS variables for automatic theme adaptation
    - `plugin/esbuild.config.mjs` — bundles all shared `lib/` and `components/` from the local fork
    - Component patches — `isPlugin` mode in `VimInput` (hides Projects nav), portal scoping in `StatusBar`, `AboutPanel`, `Sheet`
- **Reference**: Upstream PR [mskayyali/nodepad#47](https://github.com/mskayyali/nodepad/pull/47) — cherry-picking plugin infrastructure only, skipping Anthropic provider additions.

### [#023] Obsidian Plugin — Obsidian Settings UI
- **Status**: `Open` | **Priority**: `P1` | **Labels**: `Feature`, `Obsidian`, `UX`
- **Created**: 2026-05-11
- **Description**: In-Obsidian settings tab (Settings → Nodepad) for configuring the AI provider, model, and API key without touching the web app. Settings are stored in `.obsidian/plugins/nodepad/data.json`, local to the vault and never synced externally.
- **Scope**:
    - Provider dropdown (OpenRouter, OpenAI, Z.ai, Ollama, Gemini CLI)
    - API key field (hidden for keyless providers like Gemini CLI and local Ollama)
    - Model ID input with per-provider defaults
    - `plugin/src/settings.ts` — `NodepadSettingTab` extending Obsidian's `PluginSettingTab`

### [#024] Obsidian Plugin — CLI Provider Bridge (`child_process`)
- **Status**: `Open` | **Priority**: `P1` | **Labels**: `Feature`, `Obsidian`, `Architecture`
- **Created**: 2026-05-11
- **Description**: Shared infrastructure in `plugin/src/ai-adapter.ts` for invoking local CLI tools as subprocesses via Node.js `child_process` inside Obsidian's Electron environment. This is the prerequisite that makes both Gemini CLI and future Claude Code work in the plugin — neither can be called via HTTP, both need to be spawned as local processes. The web app already handles this server-side in `/api/ai`; this is the equivalent for the plugin context.
- **Scope**:
    - `spawnCLI(binary, args, stdinPayload)` — generic subprocess helper with stdout capture and timeout
    - Stdin piping for high-context prompts (mirrors existing web app pattern)
    - JSON extraction from CLI response wrappers (reuse logic from `lib/ai-ghost.ts`)
    - Error handling: binary not found, non-zero exit code, malformed output

### [#025] Obsidian Plugin — Ollama Provider Support
- **Status**: `Open` | **Priority**: `P1` | **Labels**: `Feature`, `Obsidian`, `Ollama`
- **Created**: 2026-05-11
- **Description**: Enable Ollama (both local and Cloud) as an AI provider within the Obsidian plugin. Ollama uses a different request shape than OpenAI-compatible providers (`/api/chat` instead of `/chat/completions`, no `response_format`, `stream: false`). Since `requestUrl()` in Obsidian's Electron bypasses CORS, local Ollama (`localhost:11434`) works directly without the `/api/ai` proxy — actually cleaner than the web app path.
- **Scope**:
    - Ollama request shape in `plugin/src/ai-adapter.ts` (port from `lib/ai-enrich.ts`)
    - Cloud vs local routing (mirrors existing `getBaseUrl` logic)
    - Dynamic model discovery via `requestUrl("http://localhost:11434/api/tags")`
    - No RAG/embedding support in initial version (scoped to enrichment and ghost synthesis)

### [#026] Obsidian Plugin — Gemini CLI Provider Support
- **Status**: `Open` | **Priority**: `P1` | **Labels**: `Feature`, `Obsidian`, `Gemini-CLI`
- **Created**: 2026-05-11
- **Description**: Enable Gemini CLI as a provider in the Obsidian plugin via the `child_process` bridge (#024). In the web app, Gemini CLI calls are handled server-side in `/api/ai`; in the plugin they are spawned directly from Obsidian's Electron process. Requires Gemini CLI to be installed and authenticated on the host machine. Web grounding via Gemini's native `google_web_search` tool is preserved since it runs inside the CLI itself.
- **Scope**:
    - `fetchGeminiCLI(prompt, options)` in `plugin/src/ai-adapter.ts` using the `child_process` bridge
    - Stdin piping for enrichment prompts (same pattern as web app)
    - `--policy simple` flag for structured output, two-stage web grounding for RAG
    - Settings UI: no API key field; show auth status / binary detection
    - Graceful error if `gemini` binary is not found on PATH

### [#027] Obsidian Plugin — Structured Study Guide Export to Vault
- **Status**: `Open` | **Priority**: `P2` | **Labels**: `Feature`, `Obsidian`, `AI`
- **Created**: 2026-05-11
- **Description**: On-demand command that takes enriched blocks from the current `.nodepad` canvas and writes a structured Obsidian-native `.md` file into the vault. Unlike the existing one-shot markdown export, this produces properly formatted study guides with frontmatter, `[[backlinks]]` to related vault notes, section headers per category, and source citations. Acts as the bridge from nodepad's "raw idea staging area" into Obsidian's permanent knowledge graph.
- **Scope**:
    - AI enrichment pass over all blocks to generate section groupings and a study guide outline
    - Markdown generation with YAML frontmatter (`tags`, `created`, `source: nodepad`)
    - `[[wikilink]]` insertion for terms that match existing vault note titles (via `app.vault.getMarkdownFiles()`)
    - Output path: configurable folder (default: vault root), slugified from canvas name
    - Command palette entry: "Export as Study Guide"
- **Open Questions**:
    - Should the export be a destructive replacement (overwrite) or always create a new versioned file?
    - Should tags be pulled from nodepad's `category` field or generated fresh by the AI?

### [#028] Obsidian Plugin — Human-in-the-Loop Review Before Vault Write
- **Status**: `Open` | **Priority**: `P2` | **Labels**: `Feature`, `Obsidian`, `UX`
- **Created**: 2026-05-11
- **Description**: Before any structured `.md` file is written to the vault (#027), present the user with a review panel showing the proposed study guide. The user can edit sections, approve, or cancel. Ensures the AI output is supervised before it becomes a permanent vault note. Fits the stated design goal: the AI enriches, the human decides.
- **Scope**:
    - Preview panel (modal or sidebar) showing the rendered markdown before write
    - Section-level approve/reject toggles (keep this section, drop that one)
    - Inline editing of AI-generated text before commit
    - "Write to Vault" confirmation button triggers the actual `app.vault.create()` call

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
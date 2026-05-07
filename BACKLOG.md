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
## 🛠 Environment & System Info
- **Orion Core Version:** v0.1.0
- **Frontend/Client:** Web App
- **LLM Backend:** [x] Gemini CLI [x] Ollama (Local)
- **OS:** [x] Windows [ ] macOS [ ] Linux

## 🐛 Bug Description
A runtime crash where `TileCard` failed to find an icon for an unknown content type.

## 🕹 Reproduction Steps
1. Enter a prompt that causes the AI to return an unknown content type.
2. Observe the application crash with a TypeError.

## ✅ Expected Behavior
The UI should fall back to the "General" note style.

## ❌ Actual Behavior
The application crashes (TypeError: icon of undefined).

## 📄 Relevant Logs / Output
```text
[browser] Uncaught TypeError: Cannot read properties of undefined (reading 'icon')
    at TileCard (components/tile-card.tsx:137:23)
```

## 💡 Additional Context
Fixed by adding safe lookups and input validation.

---
> [!IMPORTANT]
> **AI-Generated Report:** This issue was drafted by an AI Agent (Gemini CLI) and reviewed/approved by the repository owner before submission.
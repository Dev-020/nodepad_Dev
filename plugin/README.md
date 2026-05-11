# Nodepad for Obsidian

A native renderer for `.nodepad` files inside Obsidian. Opens spatial canvas notes — tiling, kanban, and graph views — directly in a vault tab, with the same AI-assisted enrichment and ghost-synthesis behaviour as the standalone web app. Each `.nodepad` file is an independent space stored as versioned JSON inside your vault.

---

## Status

Version 0.1.0. Desktop-only (the plugin manifest sets `isDesktopOnly: true` because it shells out to local binaries and reaches `localhost` for some providers). Not yet listed in the Obsidian Community Plugins directory — install by sideloading the release build, as described below.

---

## Install

Manual sideload:

1. Grab `main.js`, `manifest.json`, and `styles.css` from a release build (see *Build from source* below if you don't have a prebuilt release).
2. Create the folder `<vault>/.obsidian/plugins/nodepad/` and drop the three files inside.
3. In Obsidian, open **Settings → Community plugins**, make sure Restricted mode is off, click **Reload plugins**, then enable **Nodepad**.

If you use [BRAT](https://github.com/TfTHacker/obsidian42-brat), you can also point it at the GitHub repo (`Dev-020/nodepad_Dev`) to track builds automatically — provided a release is published there.

---

## Usage

Once enabled, the plugin registers itself as the handler for the `.nodepad` file extension. Open any `.nodepad` file in your vault and it will render as a Nodepad space rather than as raw JSON.

To create a new space:

- Click the **layout-dashboard** ribbon icon on the left rail, or
- Open the command palette and run **New Nodepad Space**, or
- Right-click any folder in the file explorer and choose **New Nodepad Space** to create the file inside that folder.

New files are named `Untitled Space <timestamp>.nodepad` and opened in a new tab.

Inside a space, the input bar at the bottom adds notes, the menu icon (☰) at the top-left opens **Settings → Nodepad**, and `⌘K` / `Ctrl+K` opens the command palette for switching views (tiling / kanban / graph), opening the synthesis and index panels, exporting to markdown, and clearing the canvas. `⌘Z` / `Ctrl+Z` undoes the last block change (up to 20 steps). `Escape` closes open panels.

---

## AI providers

Configure under **Settings → Nodepad**. The provider you pick is used for both note enrichment and ghost-synthesis generation.

| Provider | Key required | Notes |
|---|---|---|
| OpenRouter *(default)* | Yes | Single key for Claude, GPT-4o, Gemini, DeepSeek, Mistral, and the free Nemotron tier. |
| OpenAI | Yes | Direct OpenAI key. GPT-4o, GPT-4.1, o4-mini. |
| Z.ai | Yes | GLM-4.5 / 4.7 / 5 / 5-turbo from Zhipu AI. |
| Ollama | Optional | Toggle **Use local Ollama** to route to `http://localhost:11434` with no key. Disable the toggle to use Ollama Cloud with a key. |
| Gemini CLI | No | Uses local Google account auth via the `gemini` CLI binary. Click **Check binary** in settings to verify it's on `PATH`. |

For local Ollama, the **Discover models** button in settings fetches the model list from `localhost:11434/api/tags`. For OpenRouter and OpenAI, a **Custom base URL** field lets you override the endpoint (useful for proxies).

---

## Build from source

```
cd plugin
npm install
npm run build
```

`npm run build` runs esbuild in production mode and writes `main.js`, `manifest.json`, and `styles.css` into `plugin/dist/`. That folder is gitignored and is what you sideload into your vault's `plugins/nodepad/` directory. Use `npm run dev` instead for an inline-sourcemap watch build during development.

The build pulls source from `plugin/src/` and aliases `@/lib`, `@/components`, and `@/app` to the corresponding folders in the repo root, so the Obsidian view shares the same React components as the web app.

---

## Troubleshooting

**"gemini not found on PATH"** when using the Gemini CLI provider — install the Gemini CLI from `g.co/gemini-cli` and make sure the `gemini` binary is reachable from the shell Obsidian was launched from. On macOS, launching Obsidian from Spotlight may not inherit the same `PATH` as your terminal; launching from a shell or adjusting your login shell config can help.

**"Local Ollama not running or unreachable"** when clicking **Discover models** — confirm Ollama is running and listening on the default `http://localhost:11434`.

**Plugin doesn't appear on mobile** — this is intentional. The manifest sets `isDesktopOnly: true` because the Gemini CLI provider spawns a child process and the local-Ollama path requires `localhost` networking.

**"No API key" banner across the top of a space** — open **Settings → Nodepad** and either paste a key for your selected provider, switch to Gemini CLI, or toggle on local Ollama.

---

## Roadmap

A custom base-URL setting for Ollama is a likely future addition. The OpenRouter and OpenAI providers already expose a **Custom base URL** field; Ollama doesn't, which means users who run Ollama on a non-default endpoint — a custom `OLLAMA_HOST`, a WSL or remote box reached over the network, or Docker with a remapped port — currently can't point the plugin at it. Bringing Ollama in line with the other providers would close that gap.

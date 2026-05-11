import { App, PluginSettingTab, Setting, Notice } from "obsidian"
import type NodepadPlugin from "./main"
import { AI_PROVIDER_PRESETS, getModelsForProvider, type AIProvider } from "@/lib/ai-settings"

export interface NodepadSettings {
  provider: AIProvider
  apiKey: string
  providerKeys: Partial<Record<AIProvider, string>>
  modelId: string
  customBaseUrl: string
  useLocalOllama: boolean
  ollamaModels: string[]
  webGrounding: boolean
}

export const DEFAULT_SETTINGS: NodepadSettings = {
  provider: "openrouter",
  apiKey: "",
  providerKeys: {},
  modelId: "openai/gpt-4o",
  customBaseUrl: "",
  useLocalOllama: true,
  ollamaModels: [],
  webGrounding: false,
}

// Providers that have an actual web-search mechanism in the adapter
const GROUNDING_PROVIDERS = new Set<AIProvider>(["openrouter", "openai", "ollama", "geminicli"])

export class NodepadSettingTab extends PluginSettingTab {
  plugin: NodepadPlugin

  constructor(app: App, plugin: NodepadPlugin) {
    super(app, plugin)
    this.plugin = plugin
  }

  async fetchOllamaModels(): Promise<string[]> {
    try {
      const res = await fetch("http://localhost:11434/api/tags")
      if (!res.ok) return []
      const data = await res.json() as { models: { name: string }[] }
      return data.models.map(m => m.name)
    } catch {
      return []
    }
  }

  display() {
    const { containerEl } = this
    containerEl.empty()
    containerEl.createEl("h2", { text: "Nodepad" })

    // ── Provider ──────────────────────────────────────────────────────────────

    new Setting(containerEl)
      .setName("Provider")
      .setDesc("AI provider used for enrichment and ghost synthesis.")
      .addDropdown((drop) => {
        AI_PROVIDER_PRESETS.forEach((p) => drop.addOption(p.id, p.label))
        drop.setValue(this.plugin.settings.provider)
        drop.onChange(async (value) => {
          const newProvider = value as AIProvider
          const previousProvider = this.plugin.settings.provider

          // Save current key under the provider we're leaving
          this.plugin.settings.providerKeys = {
            ...this.plugin.settings.providerKeys,
            [previousProvider]: this.plugin.settings.apiKey,
          }

          this.plugin.settings.provider = newProvider
          this.plugin.settings.apiKey = this.plugin.settings.providerKeys[newProvider] ?? ""

          // Reset model to first available for the new provider
          const models = getModelsForProvider(newProvider)
          if (models.length > 0) this.plugin.settings.modelId = models[0].id

          // Auto-discover Ollama models when switching to Ollama
          if (newProvider === "ollama") {
            const found = await this.fetchOllamaModels()
            this.plugin.settings.ollamaModels = found
            if (found.length > 0 && !found.includes(this.plugin.settings.modelId)) {
              this.plugin.settings.modelId = found[0]
            }
          }

          await this.plugin.saveSettings()
          this.display()
        })
      })

    const provider = this.plugin.settings.provider

    // ── API key (hidden for Gemini CLI) ───────────────────────────────────────

    if (provider !== "geminicli") {
      const keyDesc = provider === "ollama" && this.plugin.settings.useLocalOllama
        ? "Leave empty when using local Ollama (no key needed for localhost)."
        : "Your API key for the selected provider."

      const preset = AI_PROVIDER_PRESETS.find(p => p.id === provider)
      let keyInputEl: HTMLInputElement

      new Setting(containerEl)
        .setName("API key")
        .setDesc(keyDesc)
        .addText((text) => {
          text
            .setPlaceholder(preset?.keyPlaceholder ?? "Enter your API key")
            .setValue(this.plugin.settings.apiKey)
            .onChange(async (value) => {
              this.plugin.settings.apiKey = value
              this.plugin.settings.providerKeys = {
                ...this.plugin.settings.providerKeys,
                [provider]: value,
              }
              await this.plugin.saveSettings()
            })
          text.inputEl.type = "password"
          text.inputEl.style.width = "100%"
          keyInputEl = text.inputEl
        })
        .addExtraButton((btn) => {
          let visible = false
          btn
            .setIcon("eye")
            .setTooltip("Show / hide API key")
            .onClick(() => {
              visible = !visible
              keyInputEl.type = visible ? "text" : "password"
              btn.setIcon(visible ? "eye-off" : "eye")
            })
        })
    } else {
      new Setting(containerEl)
        .setName("Gemini CLI status")
        .setDesc("Gemini CLI uses local Google account authentication — no API key needed.")
        .addButton((btn) => {
          btn.setButtonText("Check binary")
            .onClick(async () => {
              try {
                const { spawn } = require("child_process") as typeof import("child_process")
                await new Promise<void>((resolve, reject) => {
                  const child = spawn("gemini --version", { shell: true })
                  let out = ""
                  child.stdout.on("data", (d: Buffer) => { out += d.toString() })
                  child.on("close", (code: number) => {
                    if (code === 0) { new Notice(`Gemini CLI detected: ${out.trim()}`); resolve() }
                    else reject(new Error("not found"))
                  })
                  child.on("error", reject)
                })
              } catch {
                new Notice("gemini not found on PATH — install from g.co/gemini-cli")
              }
            })
        })
    }

    // ── Ollama: local vs cloud toggle + model discovery ───────────────────────

    if (provider === "ollama") {
      new Setting(containerEl)
        .setName("Use local Ollama")
        .setDesc("Route requests to localhost:11434 instead of Ollama Cloud.")
        .addToggle((toggle) => {
          toggle
            .setValue(this.plugin.settings.useLocalOllama)
            .onChange(async (value) => {
              this.plugin.settings.useLocalOllama = value
              await this.plugin.saveSettings()
              this.display()
            })
        })

      if (this.plugin.settings.useLocalOllama) {
        const discoveredCount = this.plugin.settings.ollamaModels.length
        new Setting(containerEl)
          .setName("Local Ollama models")
          .setDesc(discoveredCount > 0
            ? `${discoveredCount} model${discoveredCount > 1 ? "s" : ""} discovered. Click to refresh.`
            : "Click to fetch available models from localhost:11434.")
          .addButton((btn) => {
            btn.setButtonText("Discover models").onClick(async () => {
              btn.setButtonText("Discovering…")
              btn.setDisabled(true)
              const found = await this.fetchOllamaModels()
              if (found.length > 0) {
                this.plugin.settings.ollamaModels = found
                if (!found.includes(this.plugin.settings.modelId)) {
                  this.plugin.settings.modelId = found[0]
                }
                await this.plugin.saveSettings()
                new Notice(`Found ${found.length} model${found.length > 1 ? "s" : ""}: ${found.slice(0, 3).join(", ")}${found.length > 3 ? "…" : ""}`)
                this.display()
              } else {
                new Notice("Local Ollama not running or no models installed.")
                btn.setButtonText("Discover models")
                btn.setDisabled(false)
              }
            })
          })
      }
    }

    // ── Model ID ──────────────────────────────────────────────────────────────

    if (provider !== "geminicli") {
      if (provider === "ollama") {
        const discovered = this.plugin.settings.ollamaModels
        if (discovered.length > 0) {
          new Setting(containerEl)
            .setName("Model")
            .setDesc("Locally installed Ollama model.")
            .addDropdown((drop) => {
              discovered.forEach(m => drop.addOption(m, m))
              drop.setValue(this.plugin.settings.modelId)
              drop.onChange(async (value) => {
                this.plugin.settings.modelId = value
                await this.plugin.saveSettings()
              })
            })
        } else {
          new Setting(containerEl)
            .setName("Model ID")
            .setDesc("Enter a model name, or click Discover models above.")
            .addText((text) =>
              text
                .setPlaceholder("llama3.2")
                .setValue(this.plugin.settings.modelId)
                .onChange(async (value) => {
                  this.plugin.settings.modelId = value
                  await this.plugin.saveSettings()
                })
            )
        }
      } else {
        const staticModels = getModelsForProvider(provider)
        if (staticModels.length > 0) {
          new Setting(containerEl)
            .setName("Model")
            .setDesc("Model to use for AI enrichment.")
            .addDropdown((drop) => {
              staticModels.forEach(m => drop.addOption(m.id, m.label))
              drop.setValue(this.plugin.settings.modelId)
              drop.onChange(async (value) => {
                this.plugin.settings.modelId = value
                await this.plugin.saveSettings()
              })
            })
        } else {
          new Setting(containerEl)
            .setName("Model ID")
            .setDesc("e.g. hf.co/org/model for Ollama Cloud.")
            .addText((text) =>
              text
                .setPlaceholder("model-name")
                .setValue(this.plugin.settings.modelId)
                .onChange(async (value) => {
                  this.plugin.settings.modelId = value
                  await this.plugin.saveSettings()
                })
            )
        }
      }
    }

    // ── Web grounding ─────────────────────────────────────────────────────────

    if (GROUNDING_PROVIDERS.has(provider)) {
      const groundingDesc: Record<string, string> = {
        openrouter: "Appends :online to the model ID so the provider fetches live sources for claims, questions, and references.",
        openai: "Switches to a search-preview model for claim, question, and reference notes.",
        ollama: "Hybrid RAG: searches the web via Ollama Cloud, vectorizes results locally with embeddinggemma, and injects the top 5 ranked snippets as context. Requires an Ollama Cloud API key and embeddinggemma installed locally (ollama pull embeddinggemma).",
        geminicli: "Runs a two-stage pipeline: Stage 1 performs autonomous web research, Stage 2 enriches using the research as verified context.",
      }
      new Setting(containerEl)
        .setName("Web grounding")
        .setDesc(groundingDesc[provider] ?? "Enables live web search during enrichment.")
        .addToggle((toggle) => {
          toggle
            .setValue(this.plugin.settings.webGrounding)
            .onChange(async (value) => {
              this.plugin.settings.webGrounding = value
              await this.plugin.saveSettings()
            })
        })
    }

    // ── Custom base URL (advanced) ────────────────────────────────────────────

    if (provider === "openrouter" || provider === "openai") {
      new Setting(containerEl)
        .setName("Custom base URL")
        .setDesc("Override the provider endpoint (leave empty for default).")
        .addText((text) =>
          text
            .setPlaceholder("https://...")
            .setValue(this.plugin.settings.customBaseUrl)
            .onChange(async (value) => {
              this.plugin.settings.customBaseUrl = value
              await this.plugin.saveSettings()
            })
        )
    }
  }
}

import { App, PluginSettingTab, Setting, Notice } from "obsidian"
import type NodepadPlugin from "./main"
import { AI_PROVIDER_PRESETS, getModelsForProvider, type AIProvider } from "@/lib/ai-settings"

export interface NodepadSettings {
  provider: AIProvider
  apiKey: string
  modelId: string
  customBaseUrl: string
  useLocalOllama: boolean
}

export const DEFAULT_SETTINGS: NodepadSettings = {
  provider: "openrouter",
  apiKey: "",
  modelId: "openai/gpt-4o",
  customBaseUrl: "",
  useLocalOllama: true,
}

export class NodepadSettingTab extends PluginSettingTab {
  plugin: NodepadPlugin

  constructor(app: App, plugin: NodepadPlugin) {
    super(app, plugin)
    this.plugin = plugin
  }

  display() {
    const { containerEl } = this
    containerEl.empty()
    containerEl.createEl("h2", { text: "Nodepad" })

    // ── Provider ─────────────────────────────────────────────────────────────

    new Setting(containerEl)
      .setName("Provider")
      .setDesc("AI provider used for enrichment and ghost synthesis.")
      .addDropdown((drop) => {
        AI_PROVIDER_PRESETS.forEach((p) => drop.addOption(p.id, p.label))
        drop.setValue(this.plugin.settings.provider)
        drop.onChange(async (value) => {
          this.plugin.settings.provider = value as AIProvider
          const models = getModelsForProvider(value as AIProvider)
          if (models.length > 0) {
            this.plugin.settings.modelId = models[0].id
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

      new Setting(containerEl)
        .setName("API key")
        .setDesc(keyDesc)
        .addText((text) => {
          text
            .setPlaceholder(AI_PROVIDER_PRESETS.find(p => p.id === provider)?.keyPlaceholder ?? "Enter your API key")
            .setValue(this.plugin.settings.apiKey)
            .onChange(async (value) => {
              this.plugin.settings.apiKey = value
              await this.plugin.saveSettings()
            })
          text.inputEl.type = "password"
          text.inputEl.style.width = "100%"
        })
    } else {
      // Gemini CLI — show binary detection status
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
                    if (code === 0) {
                      new Notice(`Gemini CLI detected: ${out.trim()}`)
                      resolve()
                    } else {
                      reject(new Error("not found"))
                    }
                  })
                  child.on("error", reject)
                })
              } catch {
                new Notice("gemini not found on PATH — install from g.co/gemini-cli")
              }
            })
        })
    }

    // ── Ollama: local vs cloud toggle ─────────────────────────────────────────

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

      // Model discovery for local Ollama
      if (this.plugin.settings.useLocalOllama) {
        new Setting(containerEl)
          .setName("Local Ollama models")
          .setDesc("Fetches available models from localhost:11434.")
          .addButton((btn) => {
            btn.setButtonText("Discover models").onClick(async () => {
              try {
                const res = await fetch("http://localhost:11434/api/tags")
                const data = await res.json() as { models: { name: string }[] }
                const names = data.models.map(m => m.name).join(", ")
                new Notice(`Found: ${names || "none"}`)
              } catch {
                new Notice("Local Ollama not running or unreachable.")
              }
            })
          })
      }
    }

    // ── Model ID ──────────────────────────────────────────────────────────────

    if (provider !== "geminicli") {
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
        // Ollama cloud or custom provider — free-text model ID
        new Setting(containerEl)
          .setName("Model ID")
          .setDesc("e.g. llama3.2, hf.co/org/model for Ollama Cloud.")
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

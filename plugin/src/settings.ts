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
}

export const DEFAULT_SETTINGS: NodepadSettings = {
  provider: "openrouter",
  apiKey: "",
  providerKeys: {},
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

          // Save the current key under the provider we're leaving
          this.plugin.settings.providerKeys = {
            ...this.plugin.settings.providerKeys,
            [previousProvider]: this.plugin.settings.apiKey,
          }

          // Switch provider and restore the key we saved for the new one
          this.plugin.settings.provider = newProvider
          this.plugin.settings.apiKey = this.plugin.settings.providerKeys[newProvider] ?? ""

          // Reset model to the first available for the new provider
          const models = getModelsForProvider(newProvider)
          if (models.length > 0) this.plugin.settings.modelId = models[0].id

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
              // Keep providerKeys in sync so switching away preserves the latest value
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

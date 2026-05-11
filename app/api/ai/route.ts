import { NextRequest, NextResponse } from "next/server"
import { spawn } from "child_process"
import fs from "fs/promises"
import path from "path"
import os from "os"

// ── RAG UTILITIES ─────────────────────────────────────────────────────────────

function chunkText(text: string, chunkSize: number = 500): string[] {
  if (!text) return []
  const chunks: string[] = []
  for (let i = 0; i < text.length; i += chunkSize) {
    chunks.push(text.slice(i, i + chunkSize))
  }
  return chunks
}

function cosineSimilarity(v1: number[], v2: number[]): number {
  if (!v1.length || !v2.length) return 0
  let dotProduct = 0
  let normA = 0
  let normB = 0
  for (let i = 0; i < v1.length; i++) {
    dotProduct += v1[i] * v2[i]
    normA += v1[i] * v1[i]
    normB += v2[i] * v2[i]
  }
  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB))
}

async function getEmbeddings(input: string | string[]): Promise<{ embeddings: number[][]; totalDurationNs: number }> {
  try {
    const res = await fetch("http://localhost:11434/api/embed", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ model: "embeddinggemma", input }),
    })
    
    if (!res.ok) {
      const errorText = await res.text()
      console.error(` ⨯ [RAG] Local Embedding failed: ${res.status} ${errorText.slice(0, 100)}`)
      return { embeddings: [], totalDurationNs: 0 }
    }
    
    const data = await res.json()
    return { 
      embeddings: data.embeddings || [], 
      totalDurationNs: data.total_duration || 0 
    }
  } catch (e: any) {
    console.error(` ⨯ [RAG] Local Embedding error: ${e.message}`)
    return { embeddings: [], totalDurationNs: 0 }
  }
}

// ── SECURITY UTILITIES ────────────────────────────────────────────────────────

const ALLOWED_HOSTS = new Set(["localhost", "127.0.0.1", "::1"])
const ALLOWED_PORTS = new Set(["11434", "1234"]) // Ollama, LM Studio

/**
 * Executes a Gemini CLI command with stdin support and clean, high-signal logging.
 */
async function runGeminiCli(command: string, args: string[], stdinData: string, cwd: string): Promise<{ success: boolean; content: string; error?: string }> {
  return new Promise((resolve) => {
    // Escape and quote arguments to prevent shell injection and silence DEP0190
    const escapedArgs = args.map(arg => `"${arg.replace(/"/g, '\\"')}"`).join(" ")
    const child = spawn(`${command} ${escapedArgs}`, { cwd, shell: true })
    let stdoutData = ""
    let stderrData = ""

    child.stdin.write(stdinData)
    child.stdin.end()

    child.stdout.on("data", (data) => {
      stdoutData += data.toString()
    })

    child.stderr.on("data", (data) => {
      stderrData += data.toString()
      // Log critical system errors if they occur
      if (stderrData.includes("AttachConsole failed")) {
        console.warn(" ! [Gemini CLI] PTY Warning: Non-interactive mode active.")
      }
    })

    child.on("close", (code) => {
      if (code === 0) {
        try {
          const wrapper = JSON.parse(stdoutData)
          
          // Index into stats to log tool usage summary
          const tools = wrapper.stats?.tools?.byName || {}
          Object.keys(tools).forEach(toolName => {
            const count = tools[toolName].count || 0
            if (count > 0) {
              console.log(` ✓ [Gemini CLI] Tool: ${toolName} (${count} call${count > 1 ? "s" : ""})`)
            }
          })

          resolve({ success: true, content: wrapper.response || stdoutData.trim() })
        } catch (e) {
          resolve({ success: true, content: stdoutData.trim() }) 
        }
      } else {
        const errorMsg = stderrData.includes("429") ? "Rate Limit Exceeded" : `Exit Code ${code}`
        resolve({ success: false, content: "", error: errorMsg })
      }
    })

    child.on("error", (err) => {
      resolve({ success: false, content: "", error: err.message })
    })

    // Safety timeout per phase
    setTimeout(() => {
      if (child.exitCode === null) {
        child.kill()
        resolve({ success: false, content: "", error: "Timeout" })
      }
    }, 480000)
  })
}

function isLocalUrl(urlStr: string): boolean {
  try {
    const url = new URL(urlStr)
    const hostname = url.hostname.replace(/^\[(.*)\]$/, "$1")
    return ALLOWED_HOSTS.has(hostname)
  } catch {
    return false
  }
}

function validateUrlSecurity(urlStr: string): { isValid: boolean; isLocal: boolean; error?: string } {
  try {
    const url = new URL(urlStr)
    if (url.protocol !== "http:" && url.protocol !== "https:") {
      return { isValid: false, isLocal: false, error: "Only http and https protocols are allowed" }
    }
    
    const hostname = url.hostname.replace(/^\[(.*)\]$/, "$1")
    const isLocal = ALLOWED_HOSTS.has(hostname)
    
    if (isLocal) {
      if (url.protocol !== "http:") {
        return { isValid: false, isLocal: true, error: "Local requests must use http" }
      }
      if (url.port && !ALLOWED_PORTS.has(url.port)) {
        return { isValid: false, isLocal: true, error: `Port ${url.port} is not allowed for local requests` }
      }
    } else {
      // Cloud requests must be https
      if (url.protocol !== "https:") {
        return { isValid: false, isLocal: false, error: "Remote requests must use https" }
      }
    }
    
    return { isValid: true, isLocal }
  } catch {
    return { isValid: false, isLocal: false, error: "Invalid URL format" }
  }
}

function isSameOriginRequest(req: NextRequest): boolean {
  const origin = req.headers.get("origin")
  const referer = req.headers.get("referer")
  const secFetchSite = req.headers.get("sec-fetch-site")
  
  // Get the actual host the user is visiting (e.g., 192.168.3.73:3000)
  const host = req.headers.get("host")
  const protocol = req.nextUrl.protocol
  const actualOrigin = `${protocol}//${host}`

  // 1. Check Origin (usually present on POST)
  if (origin && (origin === req.nextUrl.origin || origin === actualOrigin)) return true

  // 2. Check Referer (usually present on GET)
  if (referer && (referer.startsWith(req.nextUrl.origin) || referer.startsWith(actualOrigin))) return true

  // 3. Check Sec-Fetch-Site (modern browser standard)
  if (secFetchSite === "same-origin" || secFetchSite === "none") return true

  return false
}

/**
 * AI Proxy Route Discovery
 */
export async function GET(req: NextRequest) {
  if (!isSameOriginRequest(req)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  try {
    const res = await fetch("http://localhost:11434/api/tags")
    if (!res.ok) throw new Error("Local Ollama not found")
    
    const data = await res.json()
    const rawModels = data.models || []
    const hasEmbeddingGemma = rawModels.some((m: any) => m.name.startsWith("embeddinggemma"))

    const models = rawModels.map((m: any) => ({
      id: m.name,
      label: m.name,
      shortLabel: m.name.split(":")[0],
      description: m.remote_host ? "Ollama Cloud Model" : `Local Model (${(m.size / 1024 / 1024).toFixed(0)} MB)`,
      supportsGrounding: !!m.remote_host,
      isCloud: !!m.remote_host,
      remoteHost: m.remote_host
    }))

    return NextResponse.json({ models, hasEmbeddingGemma })
  } catch (error: any) {
    return NextResponse.json({ error: error.message, models: [] }, { status: 500 })
  }
}

/**
 * AI Proxy Route
 */
export async function POST(req: NextRequest) {
  if (!isSameOriginRequest(req)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  try {
    const { url, method, headers, body, isGrounding } = await req.json()

    // ── GEMINI CLI ROUTING ───────────────────────────────────────────────────
    if (url && url.startsWith("internal://geminicli")) {
      const fullPrompt = body.messages
        .map((m: any) => `${m.role.toUpperCase()}:\n${m.content}`)
        .join("\n\n")

      const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "nodepad-gemini-"))
      
      try {
        let finalPrompt = fullPrompt

        // ── STAGE 1: AUTONOMOUS RESEARCH (IF GROUNDING ENABLED) ──────────────
        if (isGrounding) {
          console.log(` ○ [Gemini CLI] Stage 1: Researching topic...`)
          const researchStartTime = Date.now()
          
          const researchPrompt = `You are an expert researcher. Your task is to provide deep background context for the current node, informed by the surrounding context.
          
1. Analyze the current node and its relationship to other nodes in the workspace.
2. Generate multiple search queries to cover different aspects of the topic.
3. Perform the searches and fetch the content of the most relevant results using your native tools.
4. Provide a detailed, fact-dense research summary.
5. Include a "SOURCES" section at the end with the URLs and Titles you used.

Respond ONLY with the research summary and sources.`

          const researchArgs = [
            "--output-format", "json",
            "--approval-mode", "yolo",
            "--skip-trust",
            "--raw-output",
            "--accept-raw-output-risk",
            researchPrompt
          ]

          try {
            const researchResult = await runGeminiCli("gemini", researchArgs, fullPrompt, tmpDir)
            if (researchResult.success) {
              const researchDuration = ((Date.now() - researchStartTime) / 1000).toFixed(2)
              console.log(` ✓ [Gemini CLI] Research completed in ${researchDuration}s`)
              finalPrompt = `### [VERIFIED WEB CONTEXT]\n${researchResult.content}\n\n---\n\n${fullPrompt}`
            } else {
              console.warn(` ! [Gemini CLI] Research skipped: ${researchResult.error}`)
            }
          } catch (e) {
            console.warn(` ! [Gemini CLI] Research failed, proceeding without web context.`)
          }
        }

        // ── STAGE 2: STRUCTURED ENRICHMENT ───────────────────────────────────
        console.log(` ○ [Gemini CLI] Stage 2: Generating enrichment...`)
        const startTime = Date.now()
        
        const args = [
          "--output-format", "json",
          "--policy", "simple",        // Stable structured output
          "--approval-mode", "yolo",
          "--skip-trust",
          "--raw-output",
          "--accept-raw-output-risk",
          "Enrich the note provided in standard input according to the JSON schema instructions provided in that same input. CRITICAL: Do NOT use any tools or file operations. Return ONLY the final JSON object."
        ]

        const finalResult = await runGeminiCli("gemini", args, finalPrompt, tmpDir)
        const duration = ((Date.now() - startTime) / 1000).toFixed(2)

        if (finalResult.success) {
          console.log(` ✓ [Gemini CLI] Completed in ${duration}s`)
          return NextResponse.json({
            choices: [{
              message: { role: "assistant", content: finalResult.content },
              finish_reason: "stop",
            }],
          })
        } else {
          console.error(` ⨯ [Gemini CLI] Failed after ${duration}s: ${finalResult.error}`)
          return NextResponse.json({ error: finalResult.error }, { status: 500 })
        }

      } finally {
        // Safe, non-blocking cleanup for Windows stabilization
        (async () => {
          try {
            await new Promise(r => setTimeout(r, 5000)) // Wait for OS to release locks
            await fs.rm(tmpDir, { recursive: true, force: true })
          } catch (e) {
            // Silently ignore cleanup errors to prevent crashing the response
          }
        })()
      }
    }

    // ── STANDARD PROXY LOGIC ────────────────────────────────────────────────

    const security = validateUrlSecurity(url)
    if (!security.isValid) {
      return NextResponse.json({ error: security.error }, { status: 400 })
    }

    const safeHeaders = { ...headers }
    if (security.isLocal) {
      delete safeHeaders["Authorization"]
      delete safeHeaders["authorization"]
    }

    // ── INTELLIGENT OLLAMA ROUTING ───────────────────────────────────────────
    let finalUrl = url
    const isOllama = url.includes("ollama.com") || url.includes("localhost:11434")

    if (isOllama) {
      const tagsRes = await fetch("http://localhost:11434/api/tags")
      if (tagsRes.ok) {
        const tagsData = await tagsRes.json()
        const modelMeta = (tagsData.models || []).find((m: any) => m.name === body.model)
        
        if (modelMeta?.remote_host) {
          finalUrl = `${modelMeta.remote_host.replace(/:443$/, "")}/api/chat`
        } else {
          finalUrl = "http://localhost:11434/api/chat"
        }
      }
    }

    // ── OLLAMA GROUNDING (RAG) FLOW ───────────────────────────────────────────
    if (isGrounding && isOllama) {
      const cloudBaseUrl = "https://ollama.com"
      const query = body.messages[body.messages.length - 1].content

      console.log(` ○ [RAG] Searching web for context...`)

      const searchRes = await fetch(`${cloudBaseUrl}/api/web_search`, {
        method: "POST",
        headers: headers, // Use original headers for Cloud Search
        body: JSON.stringify({ query, max_results: 5 }),
      })
      
      if (searchRes.ok) {
        const { results } = await searchRes.json()
        const resultCount = results?.length || 0
        console.log(` ✓ [RAG] Found ${resultCount} results`)
        
        const allChunks: string[] = []
        for (const res of results || []) {
          const text = `[${res.title}] ${res.content.slice(0, 4000)}`
          allChunks.push(...chunkText(text, 300))
        }

        if (allChunks.length > 0) {
          console.log(` ○ [RAG] Batch vectorizing ${allChunks.length} chunks locally...`)
          const wallStartTime = Date.now()
          
          const [queryRes, chunksRes] = await Promise.all([
            getEmbeddings(query),
            getEmbeddings(allChunks)
          ])

          const queryEmb = queryRes.embeddings[0]
          const chunkEmbs = chunksRes.embeddings

          if (queryEmb && chunkEmbs.length > 0) {
            const scoredChunks: { score: number; text: string }[] = []
            for (let i = 0; i < allChunks.length; i++) {
              if (chunkEmbs[i]) {
                const score = cosineSimilarity(queryEmb, chunkEmbs[i])
                scoredChunks.push({ score, text: allChunks[i] })
              }
            }

            const wallDuration = ((Date.now() - wallStartTime) / 1000).toFixed(2)
            const modelDuration = ((queryRes.totalDurationNs + chunksRes.totalDurationNs) / 1_000_000_000).toFixed(2)

            scoredChunks.sort((a, b) => b.score - a.score)
            const topChunks = scoredChunks.slice(0, 5).map(c => c.text)

            if (topChunks.length > 0) {
              console.log(` ✓ [RAG] Injected ${topChunks.length} snippets (Model: ${modelDuration}s | Wall: ${wallDuration}s)`)
              const ragContext = `[RAG Filtered Results (Top 5 matches from Web Search)]:\n${topChunks.join("\n\n[...]\n\n")}`
              body.messages[body.messages.length - 1].content = 
                `${ragContext}\n\n---\n\nUser Question: ${query}`
            } else {
              console.log(` ⨯ [RAG] No local embeddings succeeded (${wallDuration}s)`)
            }
          } else {
            console.log(` ⨯ [RAG] Failed to generate local embeddings`)
          }
        } else {
          console.log(` ⨯ [RAG] No text found in search results`)
        }
      } else {
        console.error(` ⨯ [RAG] Search failed (Status: ${searchRes.status})`)
      }
    }

    // ── FINAL PROVIDER CALL ───────────────────────────────────────────────────
    const response = await fetch(finalUrl, {
      method: method || "POST",
      headers: safeHeaders,
      body: JSON.stringify(body),
    })

    const data = await response.json()
    return NextResponse.json(data, { status: response.status })

  } catch (error: any) {
    console.error("AI Proxy Error:", error)
    return NextResponse.json(
      { error: error.message || "Failed to proxy AI request" }, 
      { status: 500 }
    )
  }
}

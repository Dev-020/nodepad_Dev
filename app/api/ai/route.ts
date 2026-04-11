import { NextRequest, NextResponse } from "next/server"

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

  // 1. Check Origin (usually present on POST)
  if (origin && origin === req.nextUrl.origin) return true

  // 2. Check Referer (usually present on GET)
  if (referer && referer.startsWith(req.nextUrl.origin)) return true

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

    // 1. URL Validation & SSRF Protection
    const security = validateUrlSecurity(url)
    if (!security.isValid) {
      return NextResponse.json({ error: security.error }, { status: 400 })
    }

    // 2. Auth Guard: Strip keys for local requests
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

"use client"

import { loadAIConfig, getBaseUrl, getProviderHeaders, type AIConfig } from "@/lib/ai-settings"
import type { TextBlock } from "@/components/tile-card"

// ── Progress events ───────────────────────────────────────────────────────────

export type ProgressEvent =
  | { type: "phase_start";    id: string; label: string }
  | { type: "phase_done";     id: string; durationMs: number }
  | { type: "clusters_known"; clusterNames: string[] }
  | { type: "error";          id: string; message: string }

export interface CallTiming {
  id: string
  label: string
  status: "pending" | "running" | "done" | "error"
  startTime?: number
  durationMs?: number
  isParallel?: boolean
}

// ── Data types ────────────────────────────────────────────────────────────────

export interface NodeWithContext {
  id: string
  text: string
  contentType: string
  category?: string
  annotation?: string
  neighborIds: string[]
  neighborTexts: string[]
}

export interface EdgeMap {
  nodes: NodeWithContext[]
  sourceAnchors: NodeWithContext[]
}

export interface DecontextualizedNode {
  id: string
  statement: string
}

export interface ClusterAssignment {
  sectionName: string
  nodeIds: string[]
}

export interface SynthesisSection {
  heading: string
  intro: string
  sectionSynthesis: string
  nodeIds: string[]
  expandingPrompts: string[]
  gaps: string[]
}

export interface SynthesisOutline {
  sections: SynthesisSection[]
}

export interface SynthesisResult {
  outline: SynthesisOutline
  decontextualized: DecontextualizedNode[]
  clusters: ClusterAssignment[]
  timings: CallTiming[]
}

// ── Phase 1: Edge map builder ─────────────────────────────────────────────────

export function buildEdgeMap(blocks: TextBlock[]): EdgeMap {
  const byId = new Map(blocks.map(b => [b.id, b]))
  const sourceAnchors: NodeWithContext[] = []
  const nodes: NodeWithContext[] = []

  for (const block of blocks) {
    const neighborIds  = (block.influencedBy ?? []).filter(id => byId.has(id))
    const neighborTexts = neighborIds
      .map(id => byId.get(id)!)
      .map(n => [n.text, n.annotation].filter(Boolean).join(" — "))

    const node: NodeWithContext = {
      id: block.id,
      text: block.text,
      contentType: block.contentType,
      category: block.category,
      annotation: block.annotation,
      neighborIds,
      neighborTexts,
    }

    if (block.contentType === "reference") {
      sourceAnchors.push(node)
    } else {
      nodes.push(node)
    }
  }

  return { nodes, sourceAnchors }
}

// ── Shared AI helpers ─────────────────────────────────────────────────────────

function getTargetUrl(config: AIConfig): string {
  const base = getBaseUrl(config)
  return config.provider === "ollama" ? `${base}/api/chat` : `${base}/chat/completions`
}

function buildPayload(
  config: AIConfig,
  messages: { role: string; content: string }[],
  maxTokens: number,
  wantJson = true,
) {
  const isOllama = config.provider === "ollama"
  return isOllama
    ? { model: config.modelId, messages, stream: false, options: { temperature: 0.2 } }
    : {
        model: config.modelId,
        max_tokens: maxTokens,
        messages,
        temperature: 0.2,
        ...(wantJson ? { response_format: { type: "json_object" } } : {}),
      }
}

async function callAI(config: AIConfig, targetUrl: string, payload: object): Promise<string> {
  const response = await fetch("/api/ai", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      url: targetUrl,
      method: "POST",
      headers: getProviderHeaders(config),
      body: payload,
    }),
  })

  if (!response.ok) {
    const text = await response.text().catch(() => "")
    throw new Error(`AI request failed (${response.status}): ${text.slice(0, 200)}`)
  }

  const data = await response.json()
  const content = config.provider === "ollama"
    ? data.message?.content
    : data.choices?.[0]?.message?.content

  if (!content) throw new Error("Empty response from AI provider")
  return content as string
}

function dumpRawResponse(label: string, raw: string): void {
  const blob = new Blob([raw], { type: "text/plain;charset=utf-8" })
  const url  = URL.createObjectURL(blob)
  const a    = document.createElement("a")
  a.href     = url
  a.download = `${label}-raw.txt`
  a.click()
  URL.revokeObjectURL(url)
}

function extractJson(text: string): string {
  const fenced = text.match(/```(?:json)?\s*\n?([\s\S]*?)\n?\s*```/)
  if (fenced) return fenced[1].trim()
  const arrStart = text.indexOf("[")
  const arrEnd   = text.lastIndexOf("]")
  if (arrStart !== -1 && arrEnd > arrStart) return text.slice(arrStart, arrEnd + 1)
  const objStart = text.indexOf("{")
  const objEnd   = text.lastIndexOf("}")
  if (objStart !== -1 && objEnd > objStart) return text.slice(objStart, objEnd + 1)
  return text.trim()
}

export function formatDuration(ms: number): string {
  if (ms < 1000) return `<1s`
  const s = ms / 1000
  if (s < 60) return `${s.toFixed(1)}s`
  const m   = Math.floor(s / 60)
  const rem = Math.round(s % 60)
  return `${m}m ${rem}s`
}

// ── Call A: Decontextualisation ───────────────────────────────────────────────

const DECONTEXTUALIZE_SYSTEM = `You rewrite sparse research notes into self-contained statements.

RULES:
- Use ONLY the note's text, annotation, and provided neighbouring notes as context
- Do NOT draw on external knowledge — if a note is too sparse to expand, return its text unchanged
- Resolve pronouns, abbreviations, and topic shortcuts using only the provided context
- One statement per note — a single clear sentence or short paragraph
- Preserve factual meaning exactly; do not add claims absent from the context

OUTPUT: You MUST return a JSON array with one entry per input note, in the same order:
[{ "id": "...", "statement": "..." }, ...]`

export async function callDecontextualize(
  edgeMap: EdgeMap,
  config: AIConfig,
): Promise<DecontextualizedNode[]> {
  const sourceCtx = edgeMap.sourceAnchors.length > 0
    ? `SOURCE MATERIAL:\n${edgeMap.sourceAnchors.map(a => `- ${a.text}`).join("\n")}\n\n`
    : ""

  const notesJson = JSON.stringify(
    edgeMap.nodes.map(n => ({
      id: n.id,
      text: n.text,
      annotation: n.annotation ?? "",
      neighbors: n.neighborTexts,
    })),
    null, 2,
  )

  const targetUrl = getTargetUrl(config)
  const payload   = buildPayload(config, [
    { role: "system", content: DECONTEXTUALIZE_SYSTEM },
    { role: "user",   content: `${sourceCtx}Notes to expand:\n${notesJson}` },
  ], 6000)

  const raw = await callAI(config, targetUrl, payload)

  let parsed: DecontextualizedNode[] = []
  try { parsed = JSON.parse(extractJson(raw)) } catch { /* fall through */ }

  const resultMap = new Map(parsed.map(n => [n.id, n.statement]))
  return edgeMap.nodes.map(n => ({ id: n.id, statement: resultMap.get(n.id) || n.text }))
}

// ── Call B: Clustering ────────────────────────────────────────────────────────

const CLUSTER_SYSTEM = `You group research notes into semantically coherent sections.

RULES:
- Group by meaning and conceptual relationship — connection hints guide but do not dictate grouping
- Notes with no connections go into "General" unless they clearly fit an existing section
- Aim for 3–7 sections; merge thin sections rather than leaving singletons
- Every note ID must appear in exactly one section
- Name each section clearly (2–5 words)

OUTPUT: You MUST return a JSON array:
[{ "sectionName": "...", "nodeIds": ["id1", "id2"] }, ...]`

export async function callCluster(
  edgeMap: EdgeMap,
  config: AIConfig,
): Promise<ClusterAssignment[]> {
  const sourceCtx = edgeMap.sourceAnchors.length > 0
    ? `SOURCE MATERIAL:\n${edgeMap.sourceAnchors.map(a => `- ${a.text}`).join("\n")}\n\n`
    : ""

  const notesJson = JSON.stringify(
    edgeMap.nodes.map(n => ({
      id: n.id,
      text: n.text,
      category: n.category ?? "",
      contentType: n.contentType,
      connectedIds: n.neighborIds,
    })),
    null, 2,
  )

  const targetUrl = getTargetUrl(config)
  const payload   = buildPayload(config, [
    { role: "system", content: CLUSTER_SYSTEM },
    { role: "user",   content: `${sourceCtx}Notes to cluster:\n${notesJson}` },
  ], 2000)

  const raw = await callAI(config, targetUrl, payload)

  let parsed: ClusterAssignment[] = []
  try { parsed = JSON.parse(extractJson(raw)) } catch {
    return [{ sectionName: "Notes", nodeIds: edgeMap.nodes.map(n => n.id) }]
  }

  const seen   = new Set<string>()
  const allIds = new Set(edgeMap.nodes.map(n => n.id))
  const cleaned: ClusterAssignment[] = []

  for (const section of parsed) {
    const unique = (section.nodeIds ?? []).filter(id => allIds.has(id) && !seen.has(id))
    unique.forEach(id => seen.add(id))
    if (unique.length > 0) cleaned.push({ sectionName: section.sectionName, nodeIds: unique })
  }

  const missing = edgeMap.nodes.map(n => n.id).filter(id => !seen.has(id))
  if (missing.length > 0) {
    const gi = cleaned.findIndex(s => s.sectionName === "General")
    if (gi >= 0) cleaned[gi].nodeIds.push(...missing)
    else cleaned.push({ sectionName: "General", nodeIds: missing })
  }

  return cleaned
}

// ── Call C×N: Per-cluster synthesis ──────────────────────────────────────────

const CLUSTER_SYNTHESIZE_SYSTEM = `You are one of several parallel processes each generating the synthesis for one section of a multi-section document.

IMPORTANT — PARALLEL PROCESSES:
Other independent processes are simultaneously generating synthesis for every other section.
You are responsible for your assigned target section ONLY. This means:
- Do NOT explain concepts from other sections, even if it would help clarify your own.
  If a concept from another section is directly relevant, reference it by section name only
  (e.g. "as explored in the Ideal Theory section") — never explain it yourself.
- Do NOT generate expounding prompts about topics already covered in other sections.
- Do NOT flag gaps that are addressed in any other section of this document.

GROUNDING RULES:
- Use only the provided statements, annotations, and source material
- Do not draw on external knowledge
- Where notes are insufficient, flag as a gap — only if not addressed in another section

For your target section, produce:
1. heading — a clear improved section heading (2–5 words)
2. intro — 1–2 sentences: what will the reader understand from this section?
3. sectionSynthesis — 2–4 cohesive paragraphs explaining the section as a whole.
   Weave the statements AND their annotations into flowing prose. Do NOT list notes
   individually — synthesise them into a unified explanation. Use annotations for depth.
4. expandingPrompts — 2–3 open questions pushing thinking into territory NOT covered
   anywhere in this document. Do not ask about topics other sections address.
5. gaps — concepts implied by this section's notes but unexplained here AND not addressed
   in any other section. Empty array if none.

OUTPUT: Valid JSON only, no markdown, no explanation:
{
  "heading": "...",
  "intro": "...",
  "sectionSynthesis": "...",
  "expandingPrompts": ["...", "..."],
  "gaps": ["..."]
}`

type RawClusterResult = Omit<SynthesisSection, "nodeIds">

export async function callSynthesizeCluster(
  targetCluster: ClusterAssignment,
  allClusters: ClusterAssignment[],
  decontextualized: DecontextualizedNode[],
  edgeMap: EdgeMap,
  config: AIConfig,
): Promise<RawClusterResult> {
  const stmtMap  = new Map(decontextualized.map(n => [n.id, n.statement]))
  const annotMap = new Map(edgeMap.nodes.map(n => [n.id, n.annotation ?? ""]))

  const nodeSection = new Map<string, string>()
  for (const cluster of allClusters) {
    for (const id of cluster.nodeIds) nodeSection.set(id, cluster.sectionName)
  }

  const sourceCtx = edgeMap.sourceAnchors.length > 0
    ? `SOURCE MATERIAL:\n${edgeMap.sourceAnchors.map(a => `- ${a.text}`).join("\n")}\n\n`
    : ""

  const documentStructure = allClusters
    .map((c, i) => `Section ${i + 1}: "${c.sectionName}" (${c.nodeIds.length} notes)`)
    .join("\n")

  const allNotesJson = JSON.stringify(
    edgeMap.nodes.map(n => ({
      id:         n.id,
      section:    nodeSection.get(n.id) ?? "General",
      statement:  stmtMap.get(n.id) ?? n.text,
      annotation: annotMap.get(n.id) ?? "",
    })),
    null, 2,
  )

  const userMessage = [
    sourceCtx,
    `FULL DOCUMENT STRUCTURE:\n${documentStructure}`,
    `\nALL NOTES (statements + annotations):\n${allNotesJson}`,
    `\n---\nYOUR TARGET SECTION: "${targetCluster.sectionName}"`,
    `Node IDs assigned to this section: [${targetCluster.nodeIds.join(", ")}]`,
    `\nGenerate the synthesis for this section only.`,
  ].join("\n")

  const targetUrl = getTargetUrl(config)
  const payload   = buildPayload(config, [
    { role: "system", content: CLUSTER_SYNTHESIZE_SYSTEM },
    { role: "user",   content: userMessage },
  ], 4000)

  const raw = await callAI(config, targetUrl, payload)

  try {
    const jsonStr = extractJson(raw)

    let obj: RawClusterResult
    try {
      obj = JSON.parse(jsonStr)
    } catch {
      // LaTeX backslash fix: LLMs often emit \mathbb, \frac etc. as single backslashes
      // inside JSON strings, which are invalid escape sequences. Escape any \ not already
      // part of a valid JSON escape sequence and retry once.
      const fixed = jsonStr.replace(/\\(?!["\\/bfnrtu])/g, "\\\\")
      obj = JSON.parse(fixed)
    }

    return {
      heading:          obj.heading          ?? targetCluster.sectionName,
      intro:            obj.intro            ?? "",
      sectionSynthesis: obj.sectionSynthesis ?? "",
      expandingPrompts: Array.isArray(obj.expandingPrompts) ? obj.expandingPrompts : [],
      gaps:             Array.isArray(obj.gaps)             ? obj.gaps             : [],
    }
  } catch {
    const safeLabel = targetCluster.sectionName.replace(/\s+/g, "-").replace(/[^a-z0-9-]/gi, "")
    dumpRawResponse(`synthesis-callC-${safeLabel}`, raw)
    throw new Error(`Synthesis (${targetCluster.sectionName}): could not parse AI response. Raw saved to file.`)
  }
}

// ── Call D: Final editorial polish ────────────────────────────────────────────

const POLISH_SYSTEM = `You are performing a final editorial polish on a synthesis document.

The document was generated section-by-section by independent parallel processes. Your job
is to refine it as a whole for coherence, flow, and consistency across sections.

You MAY:
- Refine section headings to form a more coherent document sequence
- Adjust intro sentences to acknowledge adjacent sections where natural
- Add brief cross-references between sections where concepts connect
- Standardise terminology used inconsistently across sections
- Tighten synthesis paragraphs for clarity and cross-section flow

You MUST NOT:
- Change any line starting with "> *Source: node" — these are factual attributions
- Rewrite or remove the [!example], [!question], [!note], or [!info] callout blocks
- Add information not present in the draft
- Alter factual claims in synthesis paragraphs — editorial refinement only

Return the complete refined markdown document and nothing else.`

export async function callPolish(
  draftMarkdown: string,
  config: AIConfig,
): Promise<string> {
  const targetUrl = getTargetUrl(config)
  const payload   = buildPayload(config, [
    { role: "system", content: POLISH_SYSTEM },
    { role: "user",   content: `Polish the following synthesis document:\n\n${draftMarkdown}` },
  ], 8000, false)

  return callAI(config, targetUrl, payload)
}

// ── Main orchestration ────────────────────────────────────────────────────────

export async function generateSynthesisDocument(
  blocks: TextBlock[],
  onProgress: (event: ProgressEvent) => void,
): Promise<SynthesisResult> {
  const config = loadAIConfig()
  if (!config) throw new Error("No AI provider configured. Add an API key in Settings.")

  const enrichedBlocks = blocks.filter(b => !b.isEnriching && !b.isError)
  if (enrichedBlocks.length === 0) throw new Error("No notes to synthesise. Add some notes to the canvas first.")

  const timings: CallTiming[] = []

  function startCall(id: string, label: string, isParallel = false): number {
    const startTime = Date.now()
    timings.push({ id, label, status: "running", startTime, isParallel })
    onProgress({ type: "phase_start", id, label })
    return startTime
  }

  function doneCall(id: string, startTime: number) {
    const durationMs = Date.now() - startTime
    const t = timings.find(t => t.id === id)
    if (t) { t.status = "done"; t.durationMs = durationMs }
    onProgress({ type: "phase_done", id, durationMs })
  }

  function errorCall(id: string, message: string) {
    const t = timings.find(t => t.id === id)
    if (t) t.status = "error"
    onProgress({ type: "error", id, message })
  }

  // Phase 1 — edge map (instant)
  const edgeMap = buildEdgeMap(enrichedBlocks)
  if (edgeMap.nodes.length === 0) {
    throw new Error("All notes are reference nodes. Add content notes to the canvas.")
  }

  // Calls A + B — parallel
  const startA = startCall("callA", "Decontextualising notes", true)
  const startB = startCall("callB", "Clustering sections", true)

  let decontextualized: DecontextualizedNode[]
  let clusters: ClusterAssignment[]

  try {
    ;[decontextualized, clusters] = await Promise.all([
      callDecontextualize(edgeMap, config)
        .then(r  => { doneCall("callA", startA); return r })
        .catch(e => { errorCall("callA", String(e)); throw e }),
      callCluster(edgeMap, config)
        .then(r  => {
          doneCall("callB", startB)
          onProgress({ type: "clusters_known", clusterNames: r.map(c => c.sectionName) })
          return r
        })
        .catch(e => { errorCall("callB", String(e)); throw e }),
    ])
  } catch (e) { throw e }

  // Calls C×N — parallel, one per cluster
  const clusterStarts = clusters.map((cluster, i) =>
    startCall(`callC-${i}`, cluster.sectionName, true)
  )

  let sectionResults: RawClusterResult[]
  try {
    sectionResults = await Promise.all(
      clusters.map((cluster, i) =>
        callSynthesizeCluster(cluster, clusters, decontextualized, edgeMap, config)
          .then(r  => { doneCall(`callC-${i}`, clusterStarts[i]); return r })
          .catch(e => { errorCall(`callC-${i}`, String(e)); throw e })
      )
    )
  } catch (e) { throw e }

  const sections: SynthesisSection[] = clusters.map((cluster, i) => ({
    ...sectionResults[i],
    nodeIds: cluster.nodeIds,
  }))

  return {
    outline: { sections },
    decontextualized,
    clusters,
    timings,
  }
}

export function getSourceAnchors(blocks: TextBlock[]): TextBlock[] {
  return blocks.filter(b => b.contentType === "reference")
}

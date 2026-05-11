"use client"

import { loadAIConfig, getBaseUrl, getProviderHeaders, type AIConfig } from "@/lib/ai-settings"
import type { TextBlock } from "@/components/tile-card"

// ── Types ─────────────────────────────────────────────────────────────────────

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
  nodeIds: string[]
  expandingPrompts: string[]
  gaps: string[]
}

export interface SynthesisOutline {
  summary: string
  sections: SynthesisSection[]
}

export interface SynthesisResult {
  outline: SynthesisOutline
  decontextualized: DecontextualizedNode[]
  clusters: ClusterAssignment[]
}

// ── Phase 1: Edge map builder ─────────────────────────────────────────────────

export function buildEdgeMap(blocks: TextBlock[]): EdgeMap {
  const byId = new Map(blocks.map(b => [b.id, b]))
  const sourceAnchors: NodeWithContext[] = []
  const nodes: NodeWithContext[] = []

  for (const block of blocks) {
    const neighborIds = (block.influencedBy ?? []).filter(id => byId.has(id))
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
) {
  return config.provider === "ollama"
    ? { model: config.modelId, messages, stream: false, options: { temperature: 0.2 } }
    : {
        model: config.modelId,
        max_tokens: maxTokens,
        messages,
        response_format: { type: "json_object" },
        temperature: 0.2,
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

// ── Phase 2a: Decontextualization (Call A) ────────────────────────────────────

const DECONTEXTUALIZE_SYSTEM = `You rewrite sparse research notes into self-contained statements.

RULES:
- Use ONLY the note's text, annotation, and provided neighboring notes as context
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
  const payload = buildPayload(config, [
    { role: "system", content: DECONTEXTUALIZE_SYSTEM },
    { role: "user",   content: `${sourceCtx}Notes to expand:\n${notesJson}` },
  ], 6000)

  const raw = await callAI(config, targetUrl, payload)

  let parsed: DecontextualizedNode[] = []
  try {
    parsed = JSON.parse(extractJson(raw))
  } catch {
    return edgeMap.nodes.map(n => ({ id: n.id, statement: n.text }))
  }

  const resultMap = new Map(parsed.map(n => [n.id, n.statement]))
  return edgeMap.nodes.map(n => ({
    id: n.id,
    statement: resultMap.get(n.id) || n.text,
  }))
}

// ── Phase 2b: Clustering (Call B) ─────────────────────────────────────────────

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
  const payload = buildPayload(config, [
    { role: "system", content: CLUSTER_SYSTEM },
    { role: "user",   content: `${sourceCtx}Notes to cluster:\n${notesJson}` },
  ], 2000)

  const raw = await callAI(config, targetUrl, payload)

  let parsed: ClusterAssignment[] = []
  try {
    parsed = JSON.parse(extractJson(raw))
  } catch {
    return [{ sectionName: "Notes", nodeIds: edgeMap.nodes.map(n => n.id) }]
  }

  // Ensure every node appears in exactly one section
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

// ── Phase 2c: Synthesis (Call C) ─────────────────────────────────────────────

const SYNTHESIZE_SYSTEM = `You generate a Synthesis Document from research notes.

A Synthesis Document consolidates fragmented notes into a coherent document about the ideas
and concepts captured in a nodespace. It is NOT a summary — it contextualises notes and
pushes thinking outward through open, exploratory questions.

GROUNDING RULES — CRITICAL:
- Only use the provided statements and source material as your knowledge base
- Do NOT supplement with external knowledge
- Where notes are insufficient, flag as a gap explicitly

For each section, produce:
1. A clear section heading (improve the candidate name if needed)
2. A 1–2 sentence intro: what should the reader understand from this section?
3. 2–3 expounding prompts — open questions that push thinking into adjacent territory the
   notes do NOT cover. These invite exploration, not recall.
   GOOD: "Are there economic systems that critique capital accumulation without requiring collective ownership?"
   BAD:  "What is the labour theory of value?" (that tests recall, not exploration)
4. A gaps list: concepts implied by the notes but not explained within them (empty array if none)

Also produce a 2–3 sentence summary of the entire nodespace.

OUTPUT: You MUST return ONLY valid JSON (no markdown, no explanation):
{
  "summary": "...",
  "sections": [{
    "heading": "...",
    "intro": "...",
    "expandingPrompts": ["...", "..."],
    "gaps": ["..."]
  }]
}`

export async function callSynthesize(
  clusters: ClusterAssignment[],
  decontextualized: DecontextualizedNode[],
  sourceAnchors: NodeWithContext[],
  config: AIConfig,
): Promise<SynthesisOutline> {
  const stmtMap = new Map(decontextualized.map(n => [n.id, n.statement]))
  const sourceCtx = sourceAnchors.length > 0
    ? `SOURCE MATERIAL:\n${sourceAnchors.map(a => `- ${a.text}`).join("\n")}\n\n`
    : ""

  const sectionsJson = JSON.stringify(
    clusters.map(c => ({
      candidateHeading: c.sectionName,
      statements: c.nodeIds
        .map(id => stmtMap.get(id))
        .filter(Boolean),
    })),
    null, 2,
  )

  const targetUrl = getTargetUrl(config)
  const payload = buildPayload(config, [
    { role: "system", content: SYNTHESIZE_SYSTEM },
    { role: "user",   content: `${sourceCtx}Sections to synthesise:\n${sectionsJson}` },
  ], 4000)

  const raw = await callAI(config, targetUrl, payload)

  let parsed: { summary?: string; sections?: Omit<SynthesisSection, "nodeIds">[] }
  try {
    parsed = JSON.parse(extractJson(raw))
  } catch {
    dumpRawResponse("synthesis-call-c", raw)
    throw new Error("Synthesis: AI returned non-JSON. Raw response saved to synthesis-call-c-raw.txt")
  }

  // Normalise: handle both array-at-root and object shapes
  type RawSection = Omit<SynthesisSection, "nodeIds">
  type RootObj    = Record<string, unknown>

  let normalisedSummary: string | null = null
  let normalisedSections: RawSection[] | null = null

  if (Array.isArray(parsed)) {
    // Model returned the sections array directly — no summary
    normalisedSections = parsed as RawSection[]
    normalisedSummary  = ""
  } else {
    const root = parsed as RootObj
    normalisedSections =
      Array.isArray(root.sections)  ? root.sections  as RawSection[] :
      Array.isArray(root.data)      ? root.data       as RawSection[] :
      Array.isArray(root.synthesis) ? root.synthesis  as RawSection[] :
      null

    normalisedSummary =
      typeof root.summary     === "string" ? root.summary     :
      typeof root.overview    === "string" ? root.overview    :
      typeof root.description === "string" ? root.description :
      null
  }

  if (!normalisedSections) {
    dumpRawResponse("synthesis-call-c", raw)
    throw new Error(`Synthesis: unexpected response shape (keys: ${Object.keys(parsed as object).join(", ")}). Raw response saved to synthesis-call-c-raw.txt`)
  }

  // Merge AI-generated prose with node IDs from the clustering step (by index)
  const sections: SynthesisSection[] = normalisedSections.map((s, i) => ({
    heading:          s.heading ?? clusters[i]?.sectionName ?? `Section ${i + 1}`,
    intro:            s.intro ?? "",
    nodeIds:          clusters[i]?.nodeIds ?? [],
    expandingPrompts: s.expandingPrompts ?? [],
    gaps:             s.gaps ?? [],
  }))

  return { summary: normalisedSummary ?? "", sections }
}

// ── Main orchestration ─────────────────────────────────────────────────────────

export async function generateSynthesisDocument(
  blocks: TextBlock[],
  onProgress?: (step: string) => void,
): Promise<SynthesisResult> {
  const config = loadAIConfig()
  if (!config) throw new Error("No AI provider configured. Add an API key in Settings.")

  const enrichedBlocks = blocks.filter(b => !b.isEnriching && !b.isError)
  if (enrichedBlocks.length === 0) throw new Error("No notes to synthesise. Add some notes to the canvas first.")

  onProgress?.("Building note graph…")
  const edgeMap = buildEdgeMap(enrichedBlocks)

  if (edgeMap.nodes.length === 0) {
    throw new Error("All notes are reference nodes. Add content notes to the canvas.")
  }

  onProgress?.("Decontextualising and clustering notes…")
  const [decontextualized, clusters] = await Promise.all([
    callDecontextualize(edgeMap, config),
    callCluster(edgeMap, config),
  ])

  onProgress?.("Writing synthesis…")
  const outline = await callSynthesize(clusters, decontextualized, edgeMap.sourceAnchors, config)

  return { outline, decontextualized, clusters }
}

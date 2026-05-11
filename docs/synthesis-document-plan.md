# Synthesis Document Generation — Implementation Plan

> Backlog: [#027](../BACKLOG.md)

## What it is

A three-phase AI pipeline that consolidates enriched nodes from a `.nodepad` canvas into a structured, contextualized Obsidian markdown document. Unlike the raw markdown export (which groups nodes by content type), the Synthesis Document expands sparse notes into self-contained statements, clusters them into thematic sections by meaning, and adds expounding prompts that push thinking beyond what the notes cover.

The core problem it solves: nodepad notes are intentionally unstructured fragments. They only make full sense in the context of the source material being studied. The pipeline uses the enrichment graph (`influencedByIndices` edges, annotations, source anchor nodes) to reconstruct as much of that context as possible before synthesizing.

---

## Pipeline Overview

```
Phase 0  [Human]     Add source anchor node(s) to canvas
Phase 1  [No AI]     Build edge map from block graph
                         ↓
Phase 2a [AI Call A] ─────────────────────────────────────────── \
  Decontextualize each node into a self-contained statement        ├─→ Phase 2c [AI Call C] → Phase 3 [No AI] → Vault
Phase 2b [AI Call B] ─────────────────────────────────────────── /
  Cluster nodes into named sections
                         ↓
Phase 4  [Human]     Review output against source via external tools
```

Calls A and B run in parallel (`Promise.all`). Call C is sequential after both complete.

---

## Phase 0 — Source Anchor (Human, no code)

The user adds a `reference` or `entity` type node to the canvas naming the source material being studied.

**Example:** *"Das Kapital, Chapter 1 — Karl Marx, 1867"*

The pipeline detects these automatically (see Phase 1). If none exist, generation proceeds with a non-blocking warning: *"No source node found — adding a reference node naming your source improves output quality."*

---

## Phase 1 — Edge Map Builder (No AI)

**File:** `plugin/src/synthesis.ts`

Builds a serialized representation of the block graph for use by both parallel AI calls.

**Logic:**
1. Iterate all blocks on the canvas.
2. For each block, resolve `influencedByIndices` to get the actual neighbor block objects.
3. Identify source anchor candidates:
   - Always: `contentType === "reference"`
   - Heuristic: `contentType === "entity"` blocks referenced by many others but with few outgoing connections themselves
4. Separate anchor nodes from regular nodes.

**Output types:**

```typescript
interface NodeWithContext {
  id: string
  text: string
  contentType: ContentType
  category?: string
  annotation?: string
  neighborIds: string[]
  neighborTexts: string[]   // text + annotation of each neighbor, concatenated
}

interface EdgeMap {
  nodes: NodeWithContext[]
  sourceAnchors: NodeWithContext[]
}
```

---

## Phase 2a — Decontextualization (AI Call A, parallel)

**File:** `plugin/src/ai-adapter.ts` → `callDecontextualize(plugin, edgeMap)`

**Model:** Current provider's primary model (same as enrichment).

**Task:** Rewrite each node as a self-contained statement using only the provided neighboring notes and source anchor as context. No external knowledge fill.

**Prompt:**

```
GROUNDING RULES — CRITICAL:
Use ONLY the provided notes and context. Do not draw on external knowledge to fill gaps.
If a note is too sparse to expand meaningfully, return its original text unchanged.

SOURCE MATERIAL: {sourceAnchors}

For each note below, rewrite it as a single self-contained statement.
Use only the note's annotation and neighboring notes as context.
Resolve implicit references (pronouns, abbreviations, topic shortcuts).
Do not add information not present in the provided context.

Notes:
[
  {
    "id": "abc123",
    "text": "labour theory — socially necessary time",
    "annotation": "Marx argues value is determined by socially necessary labour time",
    "neighbors": [
      "Karl Marx — author of Das Kapital, foundational work of Marxist economic theory",
      "Surplus value: the difference between value produced by labour and wages paid"
    ]
  },
  ...
]

Return ONLY valid JSON — an array with one entry per input note, in the same order:
[{ "id": "abc123", "statement": "..." }, ...]
```

**Output:** `DecontextualizedNode[]`

```typescript
interface DecontextualizedNode {
  id: string
  statement: string
}
```

**Error handling:**
- Statement identical to original text → valid, keep it (note was too sparse to expand).
- Parse failure → fall back to `text + ". " + annotation` concatenated as the statement.

---

## Phase 2b — Clustering (AI Call B, parallel with A)

**File:** `plugin/src/ai-adapter.ts` → `callCluster(plugin, edgeMap)`

**Model:** Lightest/fastest model available for the current provider. This is the cheapest call in the pipeline — the output is only node ID groupings, no prose.

**Task:** Group nodes into semantically coherent named sections. Nodes with no connections go into "General."

**Prompt:**

```
Group the following research notes into semantically coherent sections for a synthesis document.

RULES:
- Use the connection hints to guide grouping, but group by meaning — not just graph proximity
- Notes with no connections go into a section named "General"
- Aim for 3–7 sections; merge thin sections rather than leaving singletons
- Name each section descriptively (2–5 words)
- Every note ID must appear in exactly one section

SOURCE MATERIAL: {sourceAnchors}

Notes:
[
  {
    "id": "abc123",
    "text": "labour theory — socially necessary time",
    "category": "Economics",
    "contentType": "definition",
    "connectedIds": ["def456", "ghi789"]
  },
  ...
]

Return ONLY valid JSON:
[{ "sectionName": "Labour Theory of Value", "nodeIds": ["abc123", "def456"] }, ...]
```

**Output:** `ClusterAssignment[]`

```typescript
interface ClusterAssignment {
  sectionName: string
  nodeIds: string[]
}
```

**Post-processing (no AI):**
- Verify every node ID appears in exactly one section.
- Any missing IDs → append to "General".
- Any duplicate assignments → keep first occurrence.

---

## Phase 2c — Synthesis (AI Call C, sequential)

**File:** `plugin/src/ai-adapter.ts` → `callSynthesize(plugin, mergedSections, sourceAnchors)`

**Model:** Best available for the current provider.

**Pre-merge (no AI):** Join Call A and Call B results by node ID before constructing the prompt:

```typescript
const mergedSections = clusterAssignments.map(cluster => ({
  candidateHeading: cluster.sectionName,
  statements: cluster.nodeIds
    .map(id => decontextualizedNodes.find(n => n.id === id))
    .filter(Boolean),
}))
```

**Task:** Write section headings, intros, expounding prompts, gap markers, and an overall summary. Strictly grounded on the provided statements — no external knowledge fill.

**Prompt:**

```
You are generating a Synthesis Document from research notes.

A Synthesis Document consolidates sparse, fragmented notes into a coherent document
about the ideas and concepts in the nodespace. It is not a summary — it organizes notes
into their full meaning and pushes thinking outward through open questions.

GROUNDING RULES — CRITICAL:
- Only use the provided statements and source material
- Do not supplement gaps with external knowledge
- Where notes are insufficient, flag as a gap explicitly

SOURCE MATERIAL: {sourceAnchors}

For each section:
1. Write a clear section heading (improve on the candidate name if needed)
2. Write a 1–2 sentence intro: what should the reader understand from this section?
3. Write 2–3 expounding prompts — open questions that push thinking into adjacent territory
   the notes do NOT cover. These should not test recall; they should invite exploration.
   Good example: "Are there economic systems that critique capital accumulation without
   requiring collective ownership of production?"
   Bad example: "What is the labour theory of value?" (that's just recall)
4. List any gaps: concepts implied by the notes but not explained within them

Also write a 2–3 sentence overall summary of the entire nodespace.

Sections:
[
  {
    "candidateHeading": "Labour Theory of Value",
    "statements": [
      { "id": "abc123", "statement": "In Das Kapital, Marx argues that a commodity's value..." },
      { "id": "def456", "statement": "Surplus value is the difference between..." }
    ]
  },
  ...
]

Return ONLY valid JSON:
{
  "summary": "...",
  "sections": [{
    "heading": "...",
    "intro": "...",
    "nodeIds": ["abc123", "def456"],
    "expandingPrompts": ["...", "..."],
    "gaps": ["..."]
  }]
}
```

**Output:** `SynthesisOutline`

```typescript
interface SynthesisOutline {
  summary: string
  sections: Array<{
    heading: string
    intro: string
    nodeIds: string[]
    expandingPrompts: string[]
    gaps: string[]
  }>
}
```

---

## Phase 3 — Markdown Renderer (No AI)

**File:** `lib/synthesis-export.ts`

Pure function, no Obsidian dependencies. Usable from both the plugin and the web app.

```typescript
export function renderSynthesisDocument(
  canvasName: string,
  outline: SynthesisOutline,
  decontextualized: DecontextualizedNode[],
  clusterAssignments: ClusterAssignment[],
  date: string,
): string
```

**Output format:**

```markdown
---
title: "Synthesis: Canvas Name"
tags: [synthesis, nodepad]
created: 2026-05-11
source: nodepad
---

# Canvas Name — Synthesis

> 2–3 sentence summary of the entire nodespace.

---

## Labour Theory of Value

1–2 sentence intro explaining what the reader should understand.

In Das Kapital, Marx argues that a commodity's value is determined by the socially
necessary labour time required to produce it — the foundation for his theory of
surplus value.
> *Source: nodes abc123, def456*

Surplus value is the difference between the value workers produce and the wages
they receive, which Marx identifies as the mechanism of capitalist profit extraction.
> *Source: node def456*

> [!example]- Expounding Prompts
> 1. Are there economic systems that critique capital accumulation without requiring collective ownership of production?
> 2. How does Marx's theory of value hold up against modern algorithmic pricing, where marginal cost approaches zero?

> [!question]- Gaps in your notes
> - Rate of exploitation is referenced but not defined within your notes.

---

## [Next section]
...

---
*Generated by [nodepad](https://nodepad.space) from 24 nodes · 11 May 2026*
```

**Wikilink injection (Obsidian plugin only):**
After rendering, scan the output text for terms that exactly match existing vault note titles via `app.vault.getMarkdownFiles()`. Wrap matched terms with `[[double brackets]]`. Case-insensitive, whole-word match only. Runs as a string post-pass before vault write.

**Output path:**
- Default: vault root
- Filename: `{canvas-name}-synthesis.md` (slugified)
- If file exists: append `-2`, `-3`, etc. (never overwrite)

---

## Progress UX

The command shows incremental `Notice` updates during generation:

```
Generating synthesis… (1/3) Decontextualizing nodes
Generating synthesis… (2/3) Clustering sections
Generating synthesis… (3/3) Writing synthesis
Synthesis document created: my-canvas-synthesis.md
```

On completion, the generated file opens in a new Obsidian leaf.

On any error, a `Notice` shows the error message and generation stops cleanly.

---

## New Files

| File | Purpose |
|---|---|
| `plugin/src/synthesis.ts` | Pipeline orchestration (Phases 1–3) |
| `lib/synthesis-export.ts` | Phase 3 markdown renderer (pure, no Obsidian deps) |

## Modified Files

| File | Change |
|---|---|
| `plugin/src/main.ts` | Register "Generate Synthesis Document" command |
| `plugin/src/view.tsx` | Expose `generateSynthesisDocument()` on `NodepadView` |
| `plugin/src/ai-adapter.ts` | Add `callDecontextualize`, `callCluster`, `callSynthesize` |

---

## Open Questions

1. **Model tiers:** Should Call B (clustering) explicitly use a lighter model, or always use the provider's primary? Recommendation: use primary for all three in v1; add per-call model override in a follow-up.
2. **Output folder:** Should there be a plugin setting for output path, or always write to vault root? Recommendation: vault root in v1, add setting later.
3. **Minimum block count:** Should the command be disabled when fewer than N blocks exist? Recommendation: warn at < 3 blocks, don't hard-block.
4. **Web app version:** A download variant (instead of vault write) would make this feature available outside Obsidian. Scoped out of this issue — separate backlog item if desired.

---
description: Product-led discovery and validation before specification
model: opus
handoffs:
  - label: Create Specification
    agent: speckit.specify
    prompt: Create spec from discovery findings
---

## Delegation

**Run as subagent to keep main context clean.**

If main agent: use the **Task tool** to spawn a subagent, then STOP:

```
Task tool parameters:
  subagent_type: "product"
  prompt: |
    Read and execute .claude/commands/speckit.discover.md
    Arguments: $ARGUMENTS

    Apply product discovery principles:
    - Validate problems before proposing solutions
    - Consider market context and competitive landscape
    - Prioritize by user value and business impact
    - Use Socratic dialogue to uncover hidden requirements
```

**How to delegate**: Use the Task tool with `subagent_type: "product"` and the prompt above.
The Task tool spawns an independent agent that executes the work without polluting main context.

If already a subagent: proceed to Outline below.

---

## User Input

```text
$ARGUMENTS
```

You **MUST** consider the user input before proceeding (if not empty).

**Flags:**
- `--help`: Show available modes and usage examples
- `--mode [modes]`: Specify discovery modes (comma-separated)
- `--experts [names]`: For business-panel, select specific experts
- `--output [path]`: Save discovery output to specific path

## Outline

### 1. Parse Arguments and Handle Help

If `--help` flag present, display usage guide:

```
══════════════════════════════════════════════════════════════════
  /speckit.discover - Product Discovery & Validation
══════════════════════════════════════════════════════════════════

PURPOSE:
  Explore ideas, validate problems, and discover requirements
  BEFORE creating a formal specification.

  This is the FIRST step in the spec-driven workflow for new ideas.

MODES (can combine multiple):
  problem      - Validate problem space, user personas, pain points
  market       - Competitive analysis, market opportunity, differentiation
  solution     - Explore implementation approaches, trade-offs, feasibility
  requirements - Elicit and organize requirements draft for specification

USAGE:
  /speckit.discover "idea description"
  /speckit.discover "idea" --mode problem,market
  /speckit.discover "idea" --mode solution --experts "porter,christensen"

EXAMPLES:
  /speckit.discover "AI-powered image enhancement for creators"
  /speckit.discover "subscription billing system" --mode requirements
  /speckit.discover "mobile app monetization" --mode market,solution
  /speckit.discover "real-time collaboration" --mode all

DISCOVERY TOOLS:
  This command leverages:
  - /sc:brainstorm - For Socratic exploration and technical feasibility
  - /sc:business-panel - For strategic analysis with expert frameworks

NEXT STEP:
  After discovery, run /speckit.specify to create formal specification

══════════════════════════════════════════════════════════════════
```

If `--help` provided, display the above and STOP. Do not proceed further.

### 2. Determine Discovery Modes

If no `--mode` specified, ask user which modes to explore:

```
══════════════════════════════════════════════════════════════════
  DISCOVERY MODE SELECTION
══════════════════════════════════════════════════════════════════

What aspects would you like to explore for: "{topic}"?

| Mode | Focus | Best For | Tools Used |
|------|-------|----------|------------|
| **problem** | Validate the problem exists and matters | New ideas, pivots | sc:brainstorm |
| **market** | Competitive landscape and opportunity | Market entry, differentiation | sc:business-panel |
| **solution** | Explore implementation approaches | Technical feasibility | sc:brainstorm |
| **requirements** | Elicit and organize what to build | Pre-specification | sc:brainstorm |
| **all** | Comprehensive discovery | Major initiatives | Both |

Select modes (comma-separated, e.g., "problem,market"):
```

Wait for user selection before proceeding.

### 3. Select Discovery Tool

Based on selected modes, determine which SuperClaude command to use:

**Use `/sc:brainstorm` when:**
- Mode is `problem`, `solution`, or `requirements`
- Exploring new ideas or concepts
- Need Socratic dialogue and iterative refinement
- Technical feasibility is a key concern
- Multiple technical personas needed (architect, frontend, backend)

**Use `/sc:business-panel` when:**
- Mode is `market`
- Strategic business decisions needed
- Market positioning and competitive analysis
- Need expert frameworks (Porter's Five Forces, JTBD, Blue Ocean, etc.)
- Evaluating business model or monetization

**Decision Logic:**
```
IF mode includes "market":
  → Invoke /sc:business-panel with relevant experts
     Default experts: porter, christensen, kim (Blue Ocean)

IF mode includes "problem" OR "solution" OR "requirements":
  → Invoke /sc:brainstorm with appropriate strategy
     problem: --strategy systematic --depth normal
     solution: --strategy systematic --depth deep
     requirements: --strategy agile --depth normal

IF mode is "all":
  → Run sc:business-panel for market analysis FIRST
  → Then run sc:brainstorm for problem/solution/requirements
```

### 4. Execute Discovery by Mode

For each selected mode, gather structured insights:

#### Mode: problem

**Invoke**: `/sc:brainstorm "{topic}" --strategy systematic --depth normal`

Focus areas to explore:
- **Who has this problem?** (user personas, segments, demographics)
- **How severe is the problem?** (frequency, impact, frustration level)
- **What do users do today?** (current alternatives, workarounds)
- **What happens if unsolved?** (cost of inaction, pain perpetuated)

Output: Problem validation summary

#### Mode: market

**Invoke**: `/sc:business-panel "{topic}" --experts "porter,christensen,kim" --mode discussion`

Focus areas to explore:
- **Who are the competitors?** (direct, indirect, substitutes)
- **What's the market size?** (TAM, SAM, SOM estimates)
- **What's our differentiation?** (unique value proposition)
- **What are the trends?** (growing, shrinking, shifting dynamics)

Output: Market analysis with expert frameworks applied

#### Mode: solution

**Invoke**: `/sc:brainstorm "{topic}" --strategy systematic --depth deep`

Focus areas to explore:
- **What approaches are possible?** (build, buy, partner, integrate)
- **What are the trade-offs?** (cost, time, complexity, risk)
- **What's technically feasible?** (constraints, dependencies, risks)
- **What's the MVP?** (minimum viable scope for validation)

Output: Solution options analysis with recommendations

#### Mode: requirements

**Invoke**: `/sc:brainstorm "{topic}" --strategy agile --depth normal`

Focus areas to explore:
- **What must the solution do?** (functional requirements)
- **What qualities must it have?** (non-functional requirements)
- **Who are the users?** (roles, permissions, personas)
- **What are the constraints?** (time, budget, technology, compliance)

Output: Requirements draft ready for `/speckit.specify`

### 5. Generate Discovery Summary

Create `{topic-slug}-discovery.md` in current directory (or path from `--output`):

```markdown
# Discovery: {Topic}

**Date**: {YYYY-MM-DD}
**Modes Explored**: {problem, market, solution, requirements}
**Tools Used**: {sc:brainstorm, sc:business-panel}

## Executive Summary

{2-3 sentences capturing the key findings and recommendation}

---

## Problem Validation
{If problem mode was run}

### Target Users
| Persona | Description | Pain Level | Frequency |
|---------|-------------|------------|-----------|
| {Persona 1} | {Description} | High/Medium/Low | Daily/Weekly/Monthly |

### Core Pain Points
1. **{Pain Point 1}**: {Description and severity}
2. **{Pain Point 2}**: {Description and severity}

### Current Alternatives
| Alternative | How Users Cope | Why It Falls Short |
|-------------|----------------|-------------------|
| {Alternative 1} | {Behavior} | {Gap} |

### Problem Validation Score
- Severity: {1-10}
- Frequency: {1-10}
- Willingness to Pay: {1-10}
- **Overall**: {score}/30 - {VALIDATED / NEEDS MORE RESEARCH / NOT VALIDATED}

---

## Market Analysis
{If market mode was run}

### Competitive Landscape
| Competitor | Strengths | Weaknesses | Our Differentiation |
|------------|-----------|------------|---------------------|
| {Competitor 1} | {Strength} | {Weakness} | {How we're different} |

### Market Opportunity
- **TAM**: {Total Addressable Market estimate}
- **SAM**: {Serviceable Addressable Market}
- **SOM**: {Serviceable Obtainable Market - realistic target}

### Expert Framework Insights
{Key insights from Porter's Five Forces, JTBD, Blue Ocean, etc.}

### Market Timing
{Is this the right time? What signals support this?}

---

## Solution Options
{If solution mode was run}

### Approach Comparison
| Option | Description | Pros | Cons | Effort | Recommendation |
|--------|-------------|------|------|--------|----------------|
| A | {Approach A} | {Pros} | {Cons} | {S/M/L} | {Recommended/Consider/Reject} |
| B | {Approach B} | {Pros} | {Cons} | {S/M/L} | {Recommended/Consider/Reject} |

### Technical Feasibility Assessment
- **Complexity**: {Low/Medium/High}
- **Dependencies**: {List key dependencies}
- **Risks**: {Key technical risks}
- **Timeline Estimate**: {Rough estimate}

### MVP Definition
{What's the minimum viable scope to validate the solution?}

---

## Requirements Draft
{If requirements mode was run}

### Must Have (P0)
- [ ] {Requirement 1}
- [ ] {Requirement 2}

### Should Have (P1)
- [ ] {Requirement 1}
- [ ] {Requirement 2}

### Nice to Have (P2)
- [ ] {Requirement 1}

### Out of Scope (Explicit Exclusions)
- {Exclusion 1}
- {Exclusion 2}

### Constraints
- **Technical**: {Constraints}
- **Business**: {Constraints}
- **Timeline**: {Constraints}

---

## Recommended Next Steps

1. {Immediate action item}
2. {Follow-up action item}
3. {Validation or research needed}

## Open Questions

- [ ] {Question requiring further investigation}
- [ ] {Decision that needs stakeholder input}

## Confidence Assessment

| Aspect | Confidence | Notes |
|--------|------------|-------|
| Problem | High/Medium/Low | {Why} |
| Market | High/Medium/Low | {Why} |
| Solution | High/Medium/Low | {Why} |
| Requirements | High/Medium/Low | {Why} |

**Overall Readiness for Specification**: {READY / NEEDS MORE DISCOVERY / NOT READY}
```

### 6. Present Results and Handoff

```
══════════════════════════════════════════════════════════════════
  DISCOVERY COMPLETE
══════════════════════════════════════════════════════════════════

Topic: {TOPIC}
Discovery saved to: {path}-discovery.md

Key Findings:
  - Problem: {1-sentence summary}
  - Market: {1-sentence summary}
  - Solution: {1-sentence summary}

Confidence Level: {HIGH / MEDIUM / LOW}
  {Brief reasoning for confidence assessment}

══════════════════════════════════════════════════════════════════
  RECOMMENDED NEXT STEPS
══════════════════════════════════════════════════════════════════

{IF confidence HIGH and requirements mode was run}
  Ready to create specification!
  → Run: /speckit.specify "{topic summary}"

{ELSE IF confidence MEDIUM}
  Consider additional discovery:
  → Run: /speckit.discover "{topic}" --mode {missing modes}

{ELSE IF confidence LOW}
  More research needed before specification:
  → {Specific recommendation for what to investigate}

══════════════════════════════════════════════════════════════════
```

## Boundaries

**Will:**
- Guide structured discovery through product lens
- Leverage /sc:brainstorm for Socratic exploration
- Leverage /sc:business-panel for strategic analysis
- Generate actionable discovery artifacts
- Prepare findings for specification phase
- Ask clarifying questions to uncover hidden requirements

**Will Not:**
- Create formal specifications (that's /speckit.specify)
- Make implementation decisions prematurely
- Skip discovery for complex or novel initiatives
- Override user's vision during exploration
- Proceed without user input on mode selection

## Integration with Spec-Kit Workflow

This is the PRE-SPECIFY stage:

```
DISCOVER → specify → clarify → plan → analyze → tasks → run → verify → release
    ↑
YOU ARE HERE
```

Discovery is optional but recommended for:
- New product ideas
- Major feature initiatives
- Pivots or strategic changes
- Entering new markets
- Complex technical challenges

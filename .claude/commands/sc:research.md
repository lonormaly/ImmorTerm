---
name: research
description: "Deep web research with adaptive planning and intelligent search"
model: opus
category: research
complexity: enhanced
mcp-servers: [tavily, context7, sequential-thinking]
subagent_types: [general-purpose]
---

# /sc:research - Deep Research Command

Performs comprehensive technical research on a topic using web search, documentation lookup, and analysis.

## User Input

```text
$ARGUMENTS
```

You **MUST** consider the user input before proceeding (if not empty).

## Usage

```
/sc:research "topic to research" [--output path/to/output.md] [--depth basic|deep|exhaustive]
```

**Flags:**
- `--output <path>`: Write findings to specific file (default: displays in chat)
- `--depth basic|deep|exhaustive`: Research depth (default: deep)
- `--focus <area>`: Focus on specific aspect (api|patterns|best-practices|comparison)

## Behavioral Flow

1. **Parse Research Topic**:
   - Extract the main topic from `$ARGUMENTS`
   - Identify any focus areas or constraints
   - Determine output destination (file or chat)

2. **Plan Research Strategy**:
   Use Sequential MCP for multi-step planning:
   ```
   - What are the key questions to answer?
   - What sources should be consulted?
   - What order should research proceed?
   ```

3. **Execute Research** (adapt based on `--depth`):

   **Basic** (~5 min):
   - 1-2 web searches via Tavily
   - Quick documentation lookup via Context7
   - Summarize key findings

   **Deep** (~15 min, default):
   - 3-5 web searches with different angles
   - Official documentation via Context7
   - Community patterns and solutions
   - Cross-reference multiple sources

   **Exhaustive** (~30 min):
   - Comprehensive web search coverage
   - All official documentation
   - Community forums, GitHub issues
   - Academic/research papers if relevant
   - Competitive/alternative analysis

4. **Synthesize Findings**:
   - Consolidate information from all sources
   - Identify consensus and contradictions
   - Extract actionable recommendations
   - Note confidence levels for each finding

5. **Output Results**:
   - If `--output` specified: Write to file
   - Otherwise: Display formatted findings in chat

## Research Output Format

```markdown
# {Research Topic}

## Summary
[2-3 sentence overview of key findings]

## Key Findings

### {Finding 1 Title}
[Detailed finding with evidence]
- Source: [link/reference]
- Confidence: High/Medium/Low

### {Finding 2 Title}
[Detailed finding with evidence]
- Source: [link/reference]
- Confidence: High/Medium/Low

## Recommendations

### Recommended Approach
[Primary recommendation with justification]

### Alternatives Considered
1. **{Alternative 1}**: [Why not chosen]
2. **{Alternative 2}**: [Why not chosen]

## Implementation Notes
- [Practical consideration 1]
- [Practical consideration 2]
- [Gotchas or pitfalls to avoid]

## Sources
1. [Source Title 1](url) - {brief description}
2. [Source Title 2](url) - {brief description}
3. [Source Title 3](url) - {brief description}

## Research Metadata
- Topic: {topic}
- Depth: {basic|deep|exhaustive}
- Date: {YYYY-MM-DD}
- Duration: {estimated time spent}
```

## MCP Integration

- **Tavily MCP**: Primary web search (tavily-search for queries, tavily-extract for deep content)
- **Context7 MCP**: Library/API documentation lookup (resolve-library-id → get-library-docs)
- **Sequential MCP**: Research planning and synthesis (multi-step reasoning)

## Tool Coordination

```yaml
research_workflow:
  1. tavily-search: Initial broad queries on topic
  2. context7: If library/API involved, get official docs
  3. tavily-extract: Deep-dive into promising URLs
  4. sequential-thinking: Synthesize findings into recommendations
  5. Write: Output to file if --output specified
```

## Examples

### Basic API Research
```
/sc:research "fal.ai flux training API parameters" --focus api
```

### Deep Best Practices
```
/sc:research "LoRA training best practices for Flux models" --depth deep
```

### Exhaustive with Output
```
/sc:research "React Server Components patterns 2025" --depth exhaustive --output ./research/rsc-patterns.md
```

### Research for Spec
```
/sc:research "OAuth2 PKCE flow implementation" --output specs/007-auth/research/oauth-pkce.md
```

## Integration with Spec Workflow

This command is designed to be invoked by `/speckit.specify` when research dependencies are detected:

```yaml
# Called by speckit.specify step 6.5:
Task tool:
  subagent_type: "general-purpose"
  prompt: |
    Run /sc:research "{topic from checklist}"
    --output {FEATURE_DIR}/research/{topic-slug}.md
    --depth deep
```

## Boundaries

**Will:**
- Search web for current information and best practices
- Look up official documentation for libraries/APIs
- Synthesize findings into actionable recommendations
- Write structured output to specified file path

**Will Not:**
- Implement code (research only)
- Make decisions without presenting options
- Skip source attribution
- Proceed without evidence

## Quality Standards

- **Source Attribution**: Every finding must cite sources
- **Confidence Levels**: Indicate certainty for each finding
- **Recency Check**: Prefer recent sources (within 1-2 years)
- **Multiple Sources**: Cross-reference claims across 2+ sources
- **Actionable Output**: Every research doc must include recommendations

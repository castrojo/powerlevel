# CaseStudyPilot - Agent Documentation

This project uses a three-layer agent/skill/CLI framework for AI-driven CNCF case study generation.

## Framework Documentation

**Primary Documentation:** See main repository AGENTS.md  
**Repository:** https://github.com/castrojo/casestudypilot

## Quick Reference

### Agents (Layer 1: Orchestration)

**case-study-agent (v2.3.0):**
- 14-step workflow with 5 fail-fast validation checkpoints
- Generates CNCF case studies from YouTube videos
- Extracts company, CNCF projects, metrics, and screenshots
- Quality score ≥0.60 required

**people-agent (v1.0.0):**
- Presenter profile generation from multiple videos
- Biography extraction from GitHub + video content
- Talk aggregation and expertise analysis
- Supports profile creation and updates

### Skills (Layer 2: LLM-Powered Tasks)

**Case Study Skills:**
- `transcript-correction`: Fix speech-to-text errors
- `transcript-analysis`: Extract structured data from transcripts
- `case-study-generation`: Generate polished markdown case studies

**People/Presenter Skills:**
- `biography-extraction`: Synthesize bio from multiple sources
- `talk-aggregation`: Extract themes and expertise patterns
- `presenter-profile-generation`: Generate presenter profiles

**Meta Skills:**
- `epic-creation`: Create GitHub epics from plans
- `epic-journey-update`: Document implementation journey

### CLI Tools (Layer 3: Python Commands)

**Data Operations:**
- `youtube-data`: Fetch video transcripts and metadata
- `verify-company`: Check CNCF membership via MCP server
- `extract-screenshots`: Extract frames from videos
- `assemble`: Render Jinja2 templates with data

**Validation Commands:**
- `validate-transcript`: Transcript quality check
- `validate-company`: Company name verification
- `validate-analysis`: Analysis output validation
- `validate-metrics`: Metric fabrication detection
- `validate-consistency`: Company consistency check
- `validate`: Final quality scoring
- `validate-all`: Run all validations

## Architecture Highlights

### Three-Layer Separation
```
Agents (Orchestration) → Skills (LLM) + CLI (Deterministic)
```

### Fail-Fast Validation
- 5 checkpoints with exit codes (0=pass, 1=warn, 2=critical)
- Prevents hallucination by stopping on critical failures
- Example: Empty transcript → Exit 2 → Workflow stops

### MCP Integration
- CNCF Landscape MCP Server for real-time membership/project data
- Replaces hardcoded lists with authoritative API
- Tools: `query_members`, `query_projects`, `get_project_details`

### Epic Issues as Implementation Archive
- Every major feature has an epic issue
- Contains plan link, architecture decisions, challenges, solutions
- Future agents read epics for context before modifying code

## Integration Notes

- Uses powerlevel for epic tracking and progress sync
- Leverages superpowers for development workflows
- Domain-specific agents follow superpowers patterns
- Quality-focused: ≥80% test coverage, fail-fast validation

## Key Innovation

**Fail-fast validation architecture:** Catches AI hallucination early through deterministic Python validation at critical decision points, ensuring zero hallucinations in production since v2.2.0.

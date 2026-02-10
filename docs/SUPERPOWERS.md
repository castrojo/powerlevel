# Superpowers Integration

This project is integrated with the Superpowers workflow for OpenCode.

## Context Sources

OpenCode agents working on this project have access to the following context sources:

1. **Local documentation** - Files in `docs/` directory
2. **Superpowers remote** - Shared skills and patterns from the superpowers repository
3. **Project configuration** - Settings in `.opencode/config.json`

## For AI Agents

When working on this project:

1. Check `.opencode/config.json` for enabled features and settings
2. Use skills from the superpowers remote when appropriate
3. Follow the implementation patterns in `docs/plans/`
4. Update tracking information using the epic-creation and land-the-plane skills

## Configuration

Configuration is stored in `.opencode/config.json`. See that file for details on:

- Superpowers remote settings (`superpowers.*`)
- Wiki sync behavior (`wiki.*`)
- Issue tracking integration (`tracking.*`)

## Getting Started

1. Verify superpowers remote: `git remote -v`
2. Fetch latest skills: `git fetch superpowers`
3. Check configuration: `cat .opencode/config.json`

For more information, see: https://github.com/castrojo/superpowers

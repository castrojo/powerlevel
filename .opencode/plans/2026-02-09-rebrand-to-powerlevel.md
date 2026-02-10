# Rebrand to Powerlevel Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Rebrand "opencode-superpower-github" to "Powerlevel" - a central project management dashboard that tracks multiple projects in one place. Your Powerlevel score = number of active projects you're managing.

**Architecture:** Transform current GitHub tracking plugin into a multi-project management system. Central repo holds all project plans/configs, while actual code lives in separate repositories. Projects linked via `project/name` labels.

**Tech Stack:** Node.js, GitHub CLI, GitHub Projects v2, existing libraries (cache-manager, github-cli, parser, label-manager)

---

## Task 1: Core Rebrand - Package and Documentation

Update package identity and main documentation. Change package name to opencode-powerlevel, bump version to 0.2.0, rewrite README for multi-project focus.

## Task 2: Multi-Project Support Infrastructure

Add project management library and directory structure. Create lib/project-manager.js with project listing and powerlevel calculation. Set up projects/ directory structure.

## Task 3: Project Label Support

Add project-specific labels for filtering dashboard. Update label-manager.js to create project/name labels.

## Task 4: Dashboard Creation Tooling

Create script to generate "Powerlevel N" GitHub Project board with easter egg description.

## Task 5: Project Templates

Create templates for easy project onboarding with config.json, plans/, and AGENTS.md.

## Task 6: Documentation Updates

Update AGENTS.md, create Getting Started guide, create Migration guide.

## Task 7: Manual Setup Checklist

Create checklist for GitHub repository rename and configuration.

## Task 8: Testing and Verification

Verify all imports work, directory structure exists, no stale references.

## Task 9: Release

Tag v0.2.0, push changes, create GitHub release.

---

**Design Principles:** Professional branding, practical utility, minimal easter eggs (board title/description only), keep skill names unchanged.


---

**Epic:** #34 (https://github.com/castrojo/opencode-superpower-github/issues/34)

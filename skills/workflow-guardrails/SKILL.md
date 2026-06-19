---
name: workflow-guardrails
description: MANDATORY before editing config files, running any long-running process, or touching version control in ANY project. Language- and stack-agnostic guardrails — never edit config files without approval, never start dev servers or long-running services, never commit or push on your own initiative. Always read this skill before those actions — do not rely on memory.
---

# Workflow Guardrails

Stack-agnostic rules about how to interact with a project's tooling and version control. These are hard limits — when in doubt, ask.

## Configuration files

- **Do not edit configuration files without explicit user approval.** This covers build configs, linter/formatter configs, dependency manifests (scripts/deps fields), workspace configs, environment files (`.env*`), and similar tooling files. If a task seems to require a config change (a missing path alias, a build flag, a new dependency), ask first and explain why.
- Editing source files is fine; reshaping the project's tooling is not.

## Dev servers & long-running services

- **Never start a dev server or any backend / long-running service yourself.** This includes any "dev", "start", "serve", or "watch" process — in the foreground *or* as a background job. The user owns the lifecycle of these processes and starts/stops them in their own terminal.
- **Why:** the user needs full control over when the server runs. Leftover background servers cause port conflicts, and on some platforms a running file watcher locks directories and breaks file moves.
- When a task needs the running app (browser verification, hitting an endpoint), **ask the user to start it and tell you the URL**, then proceed against that URL. Do not launch it to "just check."
- One-shot, self-terminating commands are fine to run directly: linters, type checks, tests, and builds (they exit on their own). The ban is specifically on servers/watchers that stay running.

## Git & commits

- **Never commit on your own initiative.** Even when a logical "save point" looks obvious, do not run `git commit` (or `git add` then commit) until the user has explicitly asked for it. Splitting work in the working tree is fine; turning it into commits is the user's call.
- Same rule for `git push` and any irreversible remote-affecting command (`git push --force`, branch deletion, releases, tags). Confirm explicitly first.

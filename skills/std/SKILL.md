---
name: std
disable-model-invocation: true
description: Execute a coding task under the project's coding standards. Use via `/skill:std <task>` — reads code-organization and coding-style first, then does the task. Also use whenever the user asks for standards-compliant code.
---

# Standards-Loaded Coding (/std)

Before doing anything else, read these files completely (paths relative to the project root):

1. `skills/code-organization/SKILL.md` — skip if already read earlier in this conversation.
2. `skills/coding-style/SKILL.md` — skip if already read earlier in this conversation. It is an index; follow it and read the matching reference under `skills/coding-style/references/` for the task's language (e.g. `typescript.md`, `react.md`).

Then execute the task given in the command arguments, applying both standards to every file you write or edit.

If invoked without a task (bare `/std`), confirm the standards are loaded and ask what to build.

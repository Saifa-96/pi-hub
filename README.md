# Pi Skills and Config Repo

This repository is a portable Pi configuration and skills library.

Goal:
- Keep your Pi settings and skills in one Git repo.
- Clone on a new machine, install Pi, point Pi to this repo, and use the same setup.

## 1) What this repository is for

Use this repo as your single source of truth for:
- Pi settings
- Pi model/provider configuration
- Pi skills/prompts/extensions

Pi reads config from the directory set by `PI_CODING_AGENT_DIR`.

## 2) Install Pi

Official site:
- https://pi.dev/

Quickstart docs:
- https://pi.dev/docs/latest/quickstart

## 3) Configure PI_CODING_AGENT_DIR and link to this local repo

Set `PI_CODING_AGENT_DIR` to this repository path so Pi reads config from here.

### macOS (zsh)

Persistent: add to `~/.zshrc`

```bash
export PI_CODING_AGENT_DIR="$HOME/Documents/Workspace/agent-skills"
```

### Windows PowerShell

Persistent (user-level):

Open PowerShell, replace the path with your real repository absolute path, then run the command.

```powershell
[System.Environment]::SetEnvironmentVariable(
  "PI_CODING_AGENT_DIR",
  "C:\\path\\to\\agent-skills",
  "User"
)
```

## 4) Install packages

After cloning this repository, install local dependencies (OpenSpec is installed locally, not globally):

```bash
pnpm i
```

After setting `PI_CODING_AGENT_DIR`, run the following to install all packages declared in `settings.json`:

```bash
pi update
```

## Verify

```bash
echo $PI_CODING_AGENT_DIR
pi --list-models
```

On Windows PowerShell:

```powershell
[System.Environment]::GetEnvironmentVariable("PI_CODING_AGENT_DIR", "User")
pi --list-models
```

# Pi Hub

A portable Pi configuration and skills library. Keep your Pi settings, model/provider config, and skills in one Git repo, then clone it on any machine to reproduce the same setup.

Pi reads config from the directory set by `PI_CODING_AGENT_DIR`.

## 1) Install Pi

- Site: https://pi.dev/
- Quickstart: https://pi.dev/docs/latest/quickstart

## 2) Point Pi to this repo

Set `PI_CODING_AGENT_DIR` to this repository's absolute path.

### macOS (zsh)

Add to `~/.zshrc`:

```bash
export PI_CODING_AGENT_DIR="$HOME/Documents/Workspace/pi-hub"
```

### Windows (PowerShell)

Replace the path with your real absolute path, then run:

```powershell
[System.Environment]::SetEnvironmentVariable(
  "PI_CODING_AGENT_DIR",
  "C:\\path\\to\\pi-hub",
  "User"
)
```

Optional — verify it's set:

```bash
echo $PI_CODING_AGENT_DIR   # PowerShell: [System.Environment]::GetEnvironmentVariable("PI_CODING_AGENT_DIR", "User")
```

## 3) Install packages

Install local dependencies (e.g. OpenSpec) and the packages declared in `settings.json` in one step:

```bash
pnpm i && pi update
```

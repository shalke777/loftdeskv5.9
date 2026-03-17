# LoftDesk Copilot agent team — exact setup steps

## 1) Open the repository in VS Code
Open your LoftDesk project folder in VS Code.

## 2) Copy these folders into the repo root
Copy:
- `.github`
- `.vscode`
- `mcp`

## 3) Install / update prerequisites
In terminal:
```powershell
node -v
npm -v
git --version
```
If PowerShell 7 is missing, install it. The settings file points agent terminals to `pwsh.exe`.

## 4) Update VS Code and GitHub Copilot
Use current VS Code and sign in to GitHub Copilot.

## 5) Turn on Agent mode in chat
Open Copilot Chat and select **Agent** mode.

## 6) Load customizations
In Chat, open Diagnostics and verify that VS Code sees:
- instruction files
- prompt files
- custom agents
- hooks

## 7) Approvals / autonomy
This pack enables aggressive auto-approval in `.vscode/settings.json`.
Depending on your GitHub org policy and VS Code version, you may also need to enable:
- `/autoApprove` or `/yolo` in the chat session
- or the higher permission level named **Autopilot** / **Bypass Approvals** if shown

## 8) Start the local MCP server
The server is configured through `.vscode/mcp.json` and launches via Node automatically when VS Code connects to it.
If needed, test manually:
```powershell
node .\mcp\loftdesk-mcp-server.mjs
```

## 9) First real command to run in Copilot Chat
Use prompt file `full-delivery.prompt.md` or paste:

Use the orchestrator agent. Inspect the repo, identify the highest-priority issues, fix the top ones safely, run build/lint/tests if available, get qa-reviewer verdict, and return final summary.

## 10) Best daily commands
- `Use the orchestrator agent. Fix: ...`
- `Use the orchestrator agent. Build feature: ...`
- `Use the orchestrator agent. Review the last changes and harden them for release.`

## 11) Reality check
This setup is as close as VS Code/Copilot currently gets to autonomous local delivery. You can remove many approvals, but fully unattended coding still depends on your plan, org policies, available tools, and your own local environment.

# Additional Adapters (generic profiles)

- Augment Code (augmentCode)
- Claude Code (claudeCode)
- Claude Code Chat (claudeCodeChat)
- Codex CLI (codexCli)
- Codex Online (codexOnline)
- Codex VS Code (codexVscode)
- Google Code Assist (googleCodeAssist)
- Google Gemini CLI (geminiCli)
- Gemini CLI Companion (geminiCliCompanion)
- Qwen Coder CLI (qwenCli)
- GitHub Copilot (copilot)
- Windsurf Plugin (windsurfPlugin)
- Windsurf IDE (windsurfIDE)
- Zed IDE (zed)
- Qodo Gen (qodoGen)
- Qoder (qoder)
- Amazon Q (amazonQ)

Status: Generic (config‑only). For each:
- Settings: `agent-scheduler.experimental.agents.<id>.*`
- Provide `triggerCommand` and optional `listCommand` from the target extension/IDE.
- Expand `allowedActions` when safe.
- Add links and command IDs here as we align.


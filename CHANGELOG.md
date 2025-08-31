# Changelog

## [0.0.16] - 2025-08-31

### Added
- MCP HTTP endpoint (experimental) based on Model Context Protocol SDK:
  - New settings: `agent-scheduler.experimental.mcp.http.enabled`, `.mcp.http.port` (default 4025), `.mcp.http.path` (default `/mcp`).
  - New server at `http://127.0.0.1:<port><path>` with tool `a2a.invoke` that validates input and forwards to the internal A2A handler.
  - Activation now starts the MCP endpoint when enabled; deactivation gracefully stops it.
- Agent command discovery command:
  - New command: `agent-scheduler.mapAgentCommands` to discover installed agent extensions, infer trigger/list commands, persist them to settings, and display a summary.
- Expanded agent configuration and wiring:
  - Added trigger/list command overrides for Roo Code, Continue, Cursor, Claude Code, Gemini CLI, Qwen Coder CLI; optional support flags for Copilot and Amazon Q.
  - Broadened discovery heuristics (ids, names, keywords) to match more agents.

### Changed
- Bumped version to `0.0.16`.
- Activation now starts MCP endpoint in addition to the existing gRPC server when enabled via settings.

### Notes
- The MCP server uses the official `McpServer` + `StreamableHTTPServerTransport` and exposes a single tool for now; this keeps the surface area minimal while enabling other MCP-savvy agents to call into the scheduler.

## [0.0.15] - 2025-08-31

### Added
- AgentScheduler namespace migration (contributes and commands):
  - New views container `agent-scheduler-ActivityBar` and view `agent-scheduler.SidebarProvider`.
  - New commands: `agent-scheduler.reloadWindowDev`, `agent-scheduler.openAgentScheduler`, `agent-scheduler.a2a.trigger`, `agent-scheduler.a2a.sample`.
  - New experimental command: `agent-scheduler.grpc.invoke` for quick manual gRPC A2A calls.
- Configuration (AgentScheduler prefix retained alongside legacy):
  - `agent-scheduler.experimental.activityBadge`: toggle Activity Bar badge.
  - `agent-scheduler.experimental.crossIde`: enable cross‑IDE Agent‑to‑Agent (A2A).
  - MCP forwarding scaffold: `agent-scheduler.experimental.mcp.enabled`, `...mcp.forward`, `...mcp.endpoint`.
  - gRPC A2A (experimental): `agent-scheduler.experimental.grpc.enabled`, `...grpc.host`, `...grpc.port`, `...grpc.client.enabled`, `...grpc.client.target`.
  - Per‑agent wiring: `agent-scheduler.experimental.agents.<agent>.enabled`, `.allowedActions`, and for Cline: `.triggerCommand`, `.listCommand`.
- gRPC A2A server/client scaffolding:
  - Proto: `src/protocols/grpc/a2a.proto` (service a2a.v1.A2AService Invoke(A2AMessage)→A2AResult).
  - Server: `src/protocols/grpc/server.ts` binds to configurable host/port and routes to A2A handler.
  - Client: `src/protocols/grpc/client.ts` for outbound Invoke calls (feature‑flagged).
  - Packaging: `.proto` files copied into `dist/protocols/grpc` via esbuild.
- MCP endpoint scaffolding: `src/integrations/mcp/server.ts` (exposes `a2a.invoke` tool when SDK supports it; feature‑flagged).
- Dynamic agent command discovery: `src/services/scheduler/AgentCommandMapper.ts` scans installed extensions to heuristically map trigger/list commands for known agents and stores in settings if unset.

### Changed
- Configuration title changed to "Agent Scheduler". Legacy `kilo-scheduler.*` settings remain readable for backward compatibility while new `agent-scheduler.*` settings are introduced.
- Renamed UI ids and menus to `agent-scheduler.*`. Code now focuses the new view first and falls back to legacy ids when needed.
- Updated A2A handler and MCP bridge to read new settings via a unified config helper (`src/utils/config.ts`).
- Scheduler update command renamed to `agent-scheduler.schedulesUpdated` with a fallback to the legacy command.

### Notes
- This release focuses on scaffolding and configuration wiring for A2A gRPC and MCP, plus contributes id migration. The MCP endpoint is intentionally minimal and guarded by settings until full transport/runtime semantics are finalized.

## [0.0.14] - 2025-08-31

### Fixed
- Correct icon usage across all extension surfaces:
  - Marketplace tile icon now points to a light/neutral variant via `icon: assets/icons/scheduler-icon-light.png` to avoid dark-on-dark rendering in the store.
  - Activity Bar icon now uses proper theme-specific mappings (`contributes.viewsContainers.activitybar[0].icon`):
    - `light`: `assets/icons/scheduler-icon-light.png`
    - `dark`: `assets/icons/scheduler-icon-dark.png`
  - Command icon for `kilo-scheduler.openKiloCodeExtension` corrected to use theme-appropriate assets (previously reversed):
    - `light`: `assets/icons/scheduler-icon-light.png`
    - `dark`: `assets/icons/scheduler-icon-dark.png`

### Removed
- Deleted obsolete icon assets no longer referenced anywhere:
  - `assets/icons/kilo-dark.svg`
  - `assets/icons/kilo-light.svg`
  - `assets/icons/roo-icon-black.svg`
  - `assets/icons/roo-icon-white.svg`
  - `assets/icons/scheduler-icon.png`
  - `assets/icons/scheduler-icon.svg`

### Added
- New themed icons used consistently throughout the extension:
  - `assets/icons/scheduler-icon-light.png`
  - `assets/icons/scheduler-icon-dark.png`
- Experimental setting to show active schedules count as an Activity Bar badge:
  - Setting key: `kilo-scheduler.experimental.activityBadge`
  - When enabled, the Kilo Scheduler icon in the Activity Bar shows the number of active schedules; hidden when zero.
- Experimental cross-IDE scheduler interface (WIP):
  - Setting key: `kilo-scheduler.experimental.crossIde`
  - Scaffolds a minimal adapter registry with a `Kilo Code` adapter to stabilize future integrations (cline, roo-code, Continue, Cursor, Claude Code, Gemini CLI, Qwen Coder CLI).
  - Adds command `kilo-scheduler.a2a.trigger` that accepts a minimal Agent-to-Agent (A2A) payload and best-effort triggers the Kilo Code agent.

### Changed
- Bumped extension version to `0.0.14`.
- Normalized icon references in `package.json` to use theme-aware objects where applicable.

### Notes
- All references to removed icons were audited and updated to the new scheduler icons. `.vscodeignore` already includes `!assets/icons/**`, so the new icons are packaged correctly in the VSIX.

## [0.0.11] - 2025-05-31

### Added
- Upgraded to Roo Code's latest custom_modes.yaml support

## [0.0.10] - 2025-04-25

### Fixed
- Resolved an issue where `startDate` was set by default.

### Changed
- Updated scheduling logic for interval-based tasks:
  - **If a start date/time is specified:** Intervals are now calculated from the original start time. For example, for an hourly task with a start time of 10:00am, if execution is delayed (e.g., due to inactivity or the computer being off/in deep sleep) and the task runs at 10:15am, the next execution is scheduled for 11:00am.
  - **If no start time is specified:** The interval is calculated from the last execution time. For example, if the last execution was at 10:15am, the next execution will be at 11:15am.
- Updated "Usage Tips" in the README

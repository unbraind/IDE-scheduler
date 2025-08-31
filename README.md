<div align="center">
  <img src="https://kylehoskinswebsite.s3.us-east-2.amazonaws.com/RooSchedulerPreview.png?v=2" alt="Agent Scheduler Icon" width="600" />
</div>

<div align="center">
<h1>Agent Scheduler (formerly Kilo Scheduler)</h1>

</div>

Agent Scheduler brings cross‑IDE Agent‑to‑Agent (A2A) orchestration into VS Code with multiple transports (gRPC, HTTP JSON, MCP), pluggable adapters (Kilo Code, Cline, Roo Code, Continue, Cursor, Claude Code, …), and a secure access‑key model. It also includes the original robust task‑scheduling features.

Important: This project is a fork of [kyle-apex/roo-scheduler](https://github.com/kyle-apex/roo-scheduler). All credit for the original Scheduler concept and implementation belongs to that project. This fork adapts the extension to work natively with Kilo Code (IDs, APIs, config, assets) and maintains feature parity where possible.

## Key Features

### Flexible Task Scheduling

- **Time-Based Scheduling**: Schedule tasks to run at specific intervals (minutes, hours, days)
- **Day Selection**: Configure tasks to run only on specific days of the week
- **Start & Expiration Dates**: Set when tasks should begin and automatically expire
- **Activity-Based Execution**: Optionally run tasks only when there's been user activity since the last execution

### Task Interaction Options

- **Wait Mode**: Wait for a specified period of inactivity before executing a scheduled task
- **Interrupt Mode**: Automatically interrupt any running task to execute the scheduled task
- **Skip Mode**: Skip execution if another task is already running

### Transports & Interop

- gRPC A2A: a2a.v1.A2AService with Invoke, SendMessage, CreateTask, GetTask, ListTasks, CancelTask (see `src/protocols/grpc/a2a.proto`).
- HTTP A2A: JSON endpoints at basePath (default `/a2a`): `/.well-known/agent-card`, `/invoke`, `/sendMessage`, `/tasks/*`.
- MCP: HTTP Stream transport exposing tool `a2a.invoke` using `@modelcontextprotocol/sdk`.

### Security: Access Keys

- Keys are generated once (random), hashed (SHA‑256), and stored in SecretStorage.
- Scope by transports (http/grpc/mcp) and actions (e.g., message, task.create, … or `*`).
- Require keys per transport with settings: `agent-scheduler.experimental.auth.http.required`, `.grpc.required`, `.mcp.required`.
- Commands to manage keys: Create/List/Revoke/Toggle.

### Seamless [Kilo Code](https://github.com/Kilo-Org/kilocode) Integration

Kilo Scheduler connects with [Kilo Code](https://github.com/Kilo-Org/kilocode)'s extension points which allow it to:

- Start new tasks in any available Kilo Code mode
- Pass custom instructions to Kilo Code for each scheduled task
- Provides options to execute after specified inactivity, interrupt existing tasks, or skip execution of a schedule

## Use Cases

- **Automated Code Reviews**: Schedule regular code quality checks
- **Documentation Updates**: Keep documentation in sync with code changes
- **Dependency Checks**: Regularly verify and update project dependencies
- **Codebase Analysis**: Run periodic analysis to identify optimization opportunities
- **Custom Workflows**: Automate any repetitive development task with natural language instructions (tests, memory bank, MCP etc)

## Settings Overview

- Transports:
  - `agent-scheduler.experimental.grpc.enabled|host|port`
  - `agent-scheduler.experimental.http.enabled|host|port|basePath`
  - `agent-scheduler.experimental.mcp.enabled`; `agent-scheduler.experimental.mcp.http.enabled|port|path`
- Security:
  - `agent-scheduler.experimental.auth.http.required|grpc.required|mcp.required`
  - Keys managed via commands (`AgentScheduler: Create/List/Revoke/Toggle Access Key`)
- Discovery / mapping:
  - `agent-scheduler.experimental.crossIde` (enable adapter registry)
  - `agent-scheduler.experimental.autoMapOnStartup` (discover & persist trigger/list commands)
- Per‑agent config:
  - `agent-scheduler.experimental.agents.<agent>.enabled`
  - `agent-scheduler.experimental.agents.<agent>.allowedActions`
  - `agent-scheduler.experimental.agents.<agent>.triggerCommand|listCommand`

## Usage Tips

- Currently, this extension will not wake up your computer to run a task.  It will run tasks if the screen is locked.  When VS Code “wakes up,” either when a computer starts or another background process is run, then any pending tasks will be run.
- Intervals are calculated differently depending on if start date time is specified.  For example, for an hourly task, if I have start date/time specified at 10:00am and the execution is delayed until 10:15am due to inactivity interruption delays or the computer being off/asleep, then the next task is scheduled for 11:00am. If I don’t specify start time, the hour interval is calculated from the last execution time, so the next execution will be 11:15am

## License

[Apache 2.0 © 2025 Kilo Scheduler](./LICENSE)

Note: This project is maintained by a [Kilo Code](https://github.com/Kilo-Org/kilocode) fan/contributor rather than the Kilo Code team.  Feel free to suggest features/ideas/fixes via an issue or [contribute to the project](CONTRIBUTING.md)!

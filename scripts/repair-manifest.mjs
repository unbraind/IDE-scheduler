import fs from 'fs'
import path from 'path'

const root = process.cwd()
const pkgPath = path.join(root, 'package.json')
const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'))

// 1) Bump version patch
try {
  const parts = String(pkg.version || '0.0.0').split('.')
  parts[2] = String(((parseInt(parts[2] || '0', 10) || 0) + 1))
  pkg.version = parts.join('.')
} catch {}

// 2) Activation events: remove invalid onLanguage, add view/command triggers
pkg.activationEvents = [
  'onStartupFinished',
  'onView:agent-scheduler.SidebarProvider',
  'onCommand:agent-scheduler.openAgentScheduler',
]

pkg.contributes = pkg.contributes || {}

// 3) Fix Activity Bar container + view
pkg.contributes.viewsContainers = pkg.contributes.viewsContainers || {}
const activity = pkg.contributes.viewsContainers.activitybar = pkg.contributes.viewsContainers.activitybar || []
if (activity.length === 0) activity.push({ id: 'agent-scheduler-ActivityBar', title: 'Agent Scheduler', icon: '' })
activity[0].id = 'agent-scheduler-ActivityBar'
activity[0].title = 'Agent Scheduler'
activity[0].icon = 'assets/icons/activitybar-scheduler.svg' // must be a string per VS Code schema

// 4) Fix view registration
pkg.contributes.views = pkg.contributes.views || {}
pkg.contributes.views['agent-scheduler-ActivityBar'] = [
  { type: 'webview', id: 'agent-scheduler.SidebarProvider', name: 'Agent Scheduler' },
]

// 5) Swap command icon light/dark for Open command (light uses dark icon file, dark uses light file)
pkg.contributes.commands = pkg.contributes.commands || []
const openCmd = pkg.contributes.commands.find(c => c.command === 'agent-scheduler.openAgentScheduler')
if (openCmd) {
  const icon = openCmd.icon
  if (icon && typeof icon === 'object' && icon.light && icon.dark) {
    openCmd.icon = { light: 'assets/icons/scheduler-icon-dark.png', dark: 'assets/icons/scheduler-icon-light.png' }
  }
}

// 6) Add viewsWelcome onboarding
pkg.contributes.viewsWelcome = [
  {
    view: 'agent-scheduler.SidebarProvider',
    contents: 'Welcome to Agent Scheduler.\\n[Open Scheduler](command:agent-scheduler.openAgentScheduler) \\n+Configure adapters in Settings to enable cross‑IDE triggers.',
    when: '!config.agent-scheduler.experimental.crossIde'
  },
  {
    view: 'agent-scheduler.SidebarProvider',
    contents: 'Cross‑IDE mode is enabled.\\nUse AgentScheduler: Map Agent Commands to discover adapters.',
    when: 'config.agent-scheduler.experimental.crossIde'
  }
]

// 7) Rebuild configuration properties for agent-scheduler (clean + explicit)
const props = {}
const bool = (def, description) => ({ type: 'boolean', default: def, description })
const num = (def, description) => ({ type: 'number', default: def, description })
const str = (def, description) => ({ type: 'string', default: def, description })
const arr = (items, def, description) => ({ type: 'array', items, default: def, description })

props['agent-scheduler.experimental.activityBadge'] = bool(false, 'Show active schedule count on Activity Bar icon (experimental).')
props['agent-scheduler.experimental.crossIde'] = bool(false, 'Enable cross-IDE scheduling + Agent-to-Agent triggers (experimental).')
props['agent-scheduler.experimental.autoMapOnStartup'] = bool(true, 'On activation, discover installed agent extensions and prefill trigger/list commands when missing.')

// HTTP A2A
props['agent-scheduler.experimental.http.enabled'] = bool(false, 'Enable built-in HTTP A2A endpoint.')
props['agent-scheduler.experimental.http.host'] = str('127.0.0.1', 'HTTP host/interface for A2A endpoint.')
props['agent-scheduler.experimental.http.port'] = num(50252, 'HTTP port for A2A endpoint.')
props['agent-scheduler.experimental.http.basePath'] = str('/a2a', 'Base path for HTTP A2A endpoint.')

// gRPC A2A
props['agent-scheduler.experimental.grpc.enabled'] = bool(false, 'Enable built-in gRPC A2A server.')
props['agent-scheduler.experimental.grpc.host'] = str('127.0.0.1', 'gRPC host/interface for A2A server.')
props['agent-scheduler.experimental.grpc.port'] = num(50251, 'gRPC port for A2A server.')
props['agent-scheduler.experimental.grpc.client.enabled'] = bool(false, 'Enable gRPC client for outbound A2A calls.')
props['agent-scheduler.experimental.grpc.client.target'] = str('127.0.0.1:50251', 'gRPC client target host:port.')

// MCP
props['agent-scheduler.experimental.mcp.enabled'] = bool(false, 'Enable MCP integration (experimental).')
props['agent-scheduler.experimental.mcp.forward'] = bool(false, 'Forward A2A trigger messages over MCP when enabled.')
props['agent-scheduler.experimental.mcp.endpoint'] = str('', 'MCP endpoint URL for outbound messages.')
props['agent-scheduler.experimental.mcp.http.enabled'] = bool(false, 'Expose MCP HTTP transport (local).')
props['agent-scheduler.experimental.mcp.http.port'] = num(4025, 'Port for MCP HTTP endpoint.')
props['agent-scheduler.experimental.mcp.http.path'] = str('/mcp', 'Base path for MCP HTTP endpoint.')

// Auth
props['agent-scheduler.experimental.auth.http.required'] = bool(false, 'Require an access key for HTTP A2A endpoints.')
props['agent-scheduler.experimental.auth.grpc.required'] = bool(false, 'Require an access key for gRPC A2A server.')
props['agent-scheduler.experimental.auth.mcp.required'] = bool(false, 'Require an access key for MCP HTTP endpoint.')

// Agents
const actionEnum = { type: 'string', enum: ['trigger','list','setActive','message','task.create','task.get','task.list','task.cancel'] }
const basicEnum = { type: 'string', enum: ['trigger','list','setActive'] }
const adapters = [
  { id: 'kilocode', full: true },
  { id: 'cline' },
  { id: 'rooCode' },
  { id: 'continue' },
  { id: 'cursor' },
  { id: 'claudeCode' },
  { id: 'geminiCli' },
  { id: 'qwenCli' },
]
for (const a of adapters) {
  const base = `agent-scheduler.experimental.agents.${a.id}`
  props[`${base}.enabled`] = bool(a.id === 'kilocode', `Enable ${a.id} adapter.`)
  props[`${base}.allowedActions`] = a.full
    ? arr(actionEnum, ['trigger','list','setActive','message','task.create','task.get','task.list','task.cancel'], `Allowed actions for ${a.id} adapter.`)
    : arr(basicEnum, ['trigger'], `Allowed actions for ${a.id} adapter.`)
  props[`${base}.triggerCommand`] = str('', `Override command id to trigger ${a.id}.`)
  props[`${base}.listCommand`] = str('', `Override command id to list ${a.id} schedules.`)
}
// One-off placeholder present in previous manifest
props['agent-scheduler.experimental.agents.amazonQ.triggerCommand'] = str('', 'Override command id to trigger Amazon Q.')

pkg.contributes.configuration = {
  title: 'Agent Scheduler',
  properties: props,
}

fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + '\n')
console.log('package.json repaired')


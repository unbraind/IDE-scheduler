import * as vscode from 'vscode'
import { getSetting } from '../utils/config'
import { SchedulerAdapterRegistry } from '../services/scheduler/adapters'
import { sendA2AOverMCP } from '../integrations/mcp/bridge'

// Minimal A2A (Agent-to-Agent) message shape for experimental use
export type A2AAction = 'trigger' | 'list' | 'setActive' | 'message' | 'task.create' | 'task.get' | 'task.list' | 'task.cancel'

export interface A2AMessage {
  protocol: 'a2a'
  version: string
  source?: { name?: string; id?: string }
  target: { agent: string }
  action: A2AAction
  payload?: {
    // trigger
    mode?: string
    instructions?: string
    // setActive
    scheduleId?: string
    active?: boolean
    // message
    channel?: string
    text?: string
    // tasks
    id?: string
    title?: string
    // extensibility bag
    [k: string]: unknown
  }
}

export function validateA2AMessage(input: any): { valid: boolean; errors: string[] } {
  const errors: string[] = []
  if (!input || typeof input !== 'object') {
    errors.push('Message must be an object')
  } else {
    if (input.protocol !== 'a2a') errors.push('protocol must be "a2a"')
    if (!input.version || typeof input.version !== 'string') errors.push('version must be a string')
    if (!input.target || typeof input.target.agent !== 'string' || !input.target.agent.trim()) errors.push('target.agent is required')
    if (!input.action || typeof input.action !== 'string' || !input.action.trim()) {
      errors.push('action is required')
    } else if (!['trigger','list','setActive'].includes(input.action)) {
      const allowed = ['trigger','list','setActive','message','task.create','task.get','task.list','task.cancel']
      if (!(allowed as string[]).includes(input.action)) {
        errors.push('action must be one of: ' + allowed.join(', '))
      }
    }
    if (input.payload && typeof input.payload !== 'object') errors.push('payload must be an object if provided')

    // Conditional payload checks
    if (input.action === 'setActive') {
      if (!input.payload || typeof input.payload.scheduleId !== 'string' || !input.payload.scheduleId) errors.push('payload.scheduleId is required for setActive')
      if (!input.payload || typeof input.payload.active !== 'boolean') errors.push('payload.active must be boolean for setActive')
    }
  }
  return { valid: errors.length === 0, errors }
}

function configKeyForAdapter(adapterId: string): string {
  switch (adapterId) {
    case 'kilocode': return 'kilocode'
    case 'roo-code': return 'rooCode'
    default: return adapterId
  }
}

export async function handleA2ATrigger(msg: A2AMessage | any): Promise<any> {
  const enabled = (getSetting<boolean>('experimental.crossIde') ?? false)
  if (!enabled) {
    vscode.window.showInformationMessage('A2A trigger ignored: cross-IDE experimental features are disabled.')
    return undefined
  }

  const { valid, errors } = validateA2AMessage(msg)
  if (!valid) {
    console.warn('Invalid A2A message', errors)
    return { ok: false, errors }
  }

  const registry = SchedulerAdapterRegistry.instance()
  await registry.initialize((global as any).__extensionContext || ({} as vscode.ExtensionContext))

  const target = (msg.target?.agent || '').toLowerCase()
  let adapter = registry.get(target) || registry.get('kilocode')
  if (!adapter) return { ok: false, error: 'no-adapter' }

  // Check per-adapter allowedActions from configuration
  const cfg = vscode.workspace.getConfiguration('agent-scheduler')
  const key = configKeyForAdapter(adapter.id)
  const configured = cfg.get<string[]>(`experimental.agents.${key}.allowedActions`)
  const allowed = configured ?? (adapter.id === 'kilocode' ? ['trigger','list','setActive'] : ['trigger'])
  if (!allowed.includes(msg.action)) {
    console.warn(`Action ${msg.action} not allowed for adapter ${adapter.id}`)
    return { ok: false, error: 'action-not-allowed' }
  }

  if (msg.action === 'trigger') {
    const mode = (msg.payload?.mode as string) || undefined
    const instructions = (msg.payload?.instructions as string) || undefined
    await adapter.triggerAgent({ mode, instructions, metadata: msg.payload })
    // Optional MCP forwarding
    await sendA2AOverMCP(msg)
    return { ok: true }
  }
  if (msg.action === 'list') {
    const list = await adapter.listSchedules()
    return { ok: true, data: list }
  }
  if (msg.action === 'setActive') {
    await adapter.setActive(msg.payload.scheduleId, msg.payload.active)
    return { ok: true }
  }
  return { ok: false, error: 'unsupported' }
}

function isActionAllowed(adapterId: string, action: A2AAction): boolean {
  const cfg = vscode.workspace.getConfiguration('agent-scheduler')
  const key = configKeyForAdapter(adapterId)
  const configured = cfg.get<string[]>(`experimental.agents.${key}.allowedActions`)
  const def = adapterId === 'kilocode' ? ['trigger','list','setActive','message','task.create','task.get','task.list','task.cancel'] : ['trigger']
  const allowed = (Array.isArray(configured) && configured.length > 0) ? configured : def
  return allowed.includes(action)
}

export async function handleSendMessage(args: { agent: string; channel?: string; text?: string; metadata?: any }): Promise<any> {
  const registry = SchedulerAdapterRegistry.instance()
  await registry.initialize((global as any).__extensionContext || ({} as vscode.ExtensionContext))
  const adapter = registry.get(args.agent.toLowerCase()) || registry.get('kilocode')
  if (!adapter) return { ok: false, error: 'no-adapter' }
  if (!isActionAllowed(adapter.id, 'message')) return { ok: false, error: 'action-not-allowed' }
  if (!adapter.sendMessage) return { ok: false, error: 'not-implemented' }
  const res = await adapter.sendMessage({ channel: args.channel, text: String(args.text || ''), metadata: args.metadata })
  return { ok: !!res?.ok, error: (res as any)?.error, data: (res as any)?.data }
}

export async function handleCreateTask(args: { agent: string; title?: string; params?: any }) {
  const registry = SchedulerAdapterRegistry.instance()
  await registry.initialize((global as any).__extensionContext || ({} as vscode.ExtensionContext))
  const adapter = registry.get(args.agent.toLowerCase()) || registry.get('kilocode')
  if (!adapter) return { ok: false, error: 'no-adapter' }
  if (!isActionAllowed(adapter.id, 'task.create')) return { ok: false, error: 'action-not-allowed' }
  if (!adapter.createTask) return { ok: false, error: 'not-implemented' }
  const res = await adapter.createTask({ title: args.title, params: args.params })
  return { ok: !!res?.ok, error: (res as any)?.error, task: (res as any)?.task }
}

export async function handleGetTask(args: { agent: string; id: string }) {
  const registry = SchedulerAdapterRegistry.instance()
  await registry.initialize((global as any).__extensionContext || ({} as vscode.ExtensionContext))
  const adapter = registry.get(args.agent.toLowerCase()) || registry.get('kilocode')
  if (!adapter) return { ok: false, error: 'no-adapter' }
  if (!isActionAllowed(adapter.id, 'task.get')) return { ok: false, error: 'action-not-allowed' }
  if (!adapter.getTask) return { ok: false, error: 'not-implemented' }
  const res = await adapter.getTask(args.id)
  return { ok: !!res?.ok, error: (res as any)?.error, task: (res as any)?.task }
}

export async function handleListTasks(args: { agent: string; filter?: string; options?: any }) {
  const registry = SchedulerAdapterRegistry.instance()
  await registry.initialize((global as any).__extensionContext || ({} as vscode.ExtensionContext))
  const adapter = registry.get(args.agent.toLowerCase()) || registry.get('kilocode')
  if (!adapter) return { ok: false, error: 'no-adapter' }
  if (!isActionAllowed(adapter.id, 'task.list')) return { ok: false, error: 'action-not-allowed' }
  if (!adapter.listTasks) return { ok: false, error: 'not-implemented' }
  const res = await adapter.listTasks({ filter: args.filter, options: args.options })
  return { ok: !!res?.ok, error: (res as any)?.error, tasks: (res as any)?.tasks || [] }
}

export async function handleCancelTask(args: { agent: string; id: string }) {
  const registry = SchedulerAdapterRegistry.instance()
  await registry.initialize((global as any).__extensionContext || ({} as vscode.ExtensionContext))
  const adapter = registry.get(args.agent.toLowerCase()) || registry.get('kilocode')
  if (!adapter) return { ok: false, error: 'no-adapter' }
  if (!isActionAllowed(adapter.id, 'task.cancel')) return { ok: false, error: 'action-not-allowed' }
  if (!adapter.cancelTask) return { ok: false, error: 'not-implemented' }
  const res = await adapter.cancelTask(args.id)
  return { ok: !!res?.ok, error: (res as any)?.error }
}

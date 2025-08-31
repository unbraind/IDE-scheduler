import * as vscode from 'vscode'
import { SchedulerAdapterRegistry } from '../services/scheduler/adapters'

// Minimal A2A (Agent-to-Agent) message shape for experimental use
export type A2AAction = 'trigger' | 'list' | 'setActive'

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
      errors.push('action must be one of: trigger, list, setActive')
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
  const enabled = vscode.workspace.getConfiguration('kilo-scheduler').get<boolean>('experimental.crossIde') ?? false
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
  const cfg = vscode.workspace.getConfiguration('kilo-scheduler')
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

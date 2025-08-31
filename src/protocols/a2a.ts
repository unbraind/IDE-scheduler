import * as vscode from 'vscode'
import { SchedulerAdapterRegistry } from '../services/scheduler/adapters'

// Minimal A2A (Agent-to-Agent) message shape for experimental use
export interface A2AMessage {
  protocol: 'a2a'
  version: string
  source?: { name?: string; id?: string }
  target: { agent: string }
  action: string
  payload?: Record<string, unknown>
}

export function validateA2AMessage(input: any): { valid: boolean; errors: string[] } {
  const errors: string[] = []
  if (!input || typeof input !== 'object') {
    errors.push('Message must be an object')
  } else {
    if (input.protocol !== 'a2a') errors.push('protocol must be "a2a"')
    if (!input.version || typeof input.version !== 'string') errors.push('version must be a string')
    if (!input.target || typeof input.target.agent !== 'string' || !input.target.agent.trim()) errors.push('target.agent is required')
    if (!input.action || typeof input.action !== 'string' || !input.action.trim()) errors.push('action is required')
    if (input.payload && typeof input.payload !== 'object') errors.push('payload must be an object if provided')
  }
  return { valid: errors.length === 0, errors }
}

export async function handleA2ATrigger(msg: A2AMessage | any): Promise<void> {
  const enabled = vscode.workspace.getConfiguration('kilo-scheduler').get<boolean>('experimental.crossIde') ?? false
  if (!enabled) {
    vscode.window.showInformationMessage('A2A trigger ignored: cross-IDE experimental features are disabled.')
    return
  }

  const { valid, errors } = validateA2AMessage(msg)
  if (!valid) {
    console.warn('Invalid A2A message', errors)
    return
  }

  const registry = SchedulerAdapterRegistry.instance()
  await registry.initialize((global as any).__extensionContext || ({} as vscode.ExtensionContext))

  const target = (msg.target?.agent || '').toLowerCase()
  const adapter = registry.get(target) || registry.get('kilocode')
  if (!adapter) return
  const mode = (msg.payload?.mode as string) || undefined
  const instructions = (msg.payload?.instructions as string) || undefined
  await adapter.triggerAgent({ mode, instructions, metadata: msg.payload })
}

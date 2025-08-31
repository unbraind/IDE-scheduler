import * as vscode from 'vscode'
import { ISchedulerAdapter } from './ISchedulerAdapter'
import { KiloCodeAdapter } from './KiloCodeAdapter'
import { ClineAdapter } from './ClineAdapter'
import { RooCodeAdapter } from './RooCodeAdapter'
import { ContinueAdapter } from './ContinueAdapter'
import { CursorAdapter } from './CursorAdapter'
import { ClaudeCodeAdapter } from './ClaudeCodeAdapter'
import { GeminiCliAdapter } from './GeminiCliAdapter'
import { QwenCoderCliAdapter } from './QwenCoderCliAdapter'
import { discoverAgentCommands } from '../AgentCommandMapper'

export class SchedulerAdapterRegistry {
  private static _instance: SchedulerAdapterRegistry
  private adapters = new Map<string, ISchedulerAdapter>()
  private initialized = false

  static instance(): SchedulerAdapterRegistry {
    if (!this._instance) this._instance = new SchedulerAdapterRegistry()
    return this._instance
  }

  async initialize(context: vscode.ExtensionContext) {
    if (this.initialized) return
    // Register built-in Kilo Code adapter first
    const kilo = new KiloCodeAdapter()
    this.adapters.set(kilo.id, kilo)
    await kilo.initialize(context)
    // Conditionally register experimental adapters
    const crossIde = (vscode.workspace.getConfiguration('agent-scheduler').get<boolean>('experimental.crossIde') ??
                      vscode.workspace.getConfiguration('kilo-scheduler').get<boolean>('experimental.crossIde') ?? false)
    if (crossIde) {
      const cfg = vscode.workspace.getConfiguration('agent-scheduler')
      const enabled = (key: string, def = false) => cfg.get<boolean>(`experimental.agents.${key}.enabled`) ?? def

      const creations: ISchedulerAdapter[] = []
      if (enabled('cline')) creations.push(new ClineAdapter())
      if (enabled('rooCode')) creations.push(new RooCodeAdapter())
      if (enabled('continue')) creations.push(new ContinueAdapter())
      if (enabled('cursor')) creations.push(new CursorAdapter())
      if (enabled('claudeCode')) creations.push(new ClaudeCodeAdapter())
      if (enabled('geminiCli')) creations.push(new GeminiCliAdapter())
      if (enabled('qwenCli')) creations.push(new QwenCoderCliAdapter())

      for (const adapter of creations) {
        this.adapters.set(adapter.id, adapter)
      }
      await Promise.all(creations.map(a => a.initialize(context)))

      // Best-effort discovery of commands for known agents; write to settings if unset
      try {
        const discovered = await discoverAgentCommands()
        for (const m of discovered) {
          if (!m.agent) continue
          const triggerKey = `experimental.agents.${m.agent}.triggerCommand`
          const listKey = `experimental.agents.${m.agent}.listCommand`
          const curTrigger = cfg.get<string>(triggerKey)
          const curList = cfg.get<string>(listKey)
          if (!curTrigger && m.triggerCommand) await cfg.update(triggerKey, m.triggerCommand, true)
          if (!curList && m.listCommand) await cfg.update(listKey, m.listCommand, true)
        }
      } catch {}
    }
    this.initialized = true
  }

  get(id: string): ISchedulerAdapter | undefined {
    return this.adapters.get(id)
  }

  all(): ISchedulerAdapter[] {
    return [...this.adapters.values()]
  }
}

import * as vscode from 'vscode'
import { ISchedulerAdapter, ScheduleSummary, TriggerOptions } from './ISchedulerAdapter'

/**
 * Experimental stub for Cline adapter. No-op methods for now.
 * TODO: Implement real schedule sync and trigger integration once API is finalized.
 */
export class ClineAdapter implements ISchedulerAdapter {
  public readonly id = 'cline'
  public readonly title = 'Cline'
  private triggerId: string | null = null
  private listId: string | null = null

  async initialize(_context: vscode.ExtensionContext): Promise<void> {
    const cfg = vscode.workspace.getConfiguration('agent-scheduler')
    this.triggerId = cfg.get<string>('experimental.agents.cline.triggerCommand') ?? 'cline.newTask'
    this.listId = cfg.get<string>('experimental.agents.cline.listCommand') ?? null
  }

  async listSchedules(): Promise<ScheduleSummary[]> {
    try {
      if (this.listId) {
        const result = await vscode.commands.executeCommand(this.listId)
        if (Array.isArray(result)) return result as ScheduleSummary[]
      }
    } catch (e) {
      console.warn('ClineAdapter.listSchedules failed', e)
    }
    return []
  }

  async getActiveCount(): Promise<number> {
    return 0
  }

  async setActive(_scheduleId: string, _active: boolean): Promise<void> {
    // No-op
  }

  async triggerAgent(_opts: TriggerOptions): Promise<void> {
    try {
      const cfg = vscode.workspace.getConfiguration('agent-scheduler')
      const triggerId = this.triggerId || cfg.get<string>('experimental.agents.cline.triggerCommand') || 'cline.newTask'
      const payload = {
        instructions: _opts.instructions,
        mode: _opts.mode,
        metadata: _opts.metadata,
      }
      await vscode.commands.executeCommand(triggerId, payload)
    } catch (e) {
      console.warn('ClineAdapter.triggerAgent failed', e)
    }
  }
}

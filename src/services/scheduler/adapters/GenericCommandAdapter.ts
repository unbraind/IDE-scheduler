import * as vscode from 'vscode'
import { ISchedulerAdapter, ScheduleSummary, TriggerOptions, TaskSummary } from './ISchedulerAdapter'

export class GenericCommandAdapter implements ISchedulerAdapter {
  readonly id: string
  readonly title: string
  private triggerKey: string
  private listKey: string

  constructor(id: string, title?: string) {
    this.id = id.toLowerCase()
    this.title = title || id
    this.triggerKey = `agent-scheduler.experimental.agents.${id}.triggerCommand`
    this.listKey = `agent-scheduler.experimental.agents.${id}.listCommand`
  }

  async initialize(_context: vscode.ExtensionContext): Promise<void> {
    // no-op
  }

  private get cfg() { return vscode.workspace.getConfiguration() }

  async listSchedules(): Promise<ScheduleSummary[]> {
    const cmd = this.cfg.get<string>(this.listKey)
    if (!cmd) return []
    try {
      const res = await vscode.commands.executeCommand<any>(cmd)
      if (Array.isArray(res)) return res as ScheduleSummary[]
    } catch {}
    return []
  }

  async getActiveCount(): Promise<number> {
    try { return (await this.listSchedules()).filter(s => s.active).length } catch { return 0 }
  }

  async setActive(_scheduleId: string, _active: boolean): Promise<void> {
    // Generic adapter cannot toggle activity without a specific command API
    // This is intentionally a no-op unless we add per-adapter hooks later.
  }

  async triggerAgent(opts: TriggerOptions): Promise<void> {
    const cmd = this.cfg.get<string>(this.triggerKey)
    if (!cmd) throw new Error(`No triggerCommand configured for adapter ${this.id}`)
    try {
      await vscode.commands.executeCommand(cmd, opts)
    } catch (e: any) {
      vscode.window.showErrorMessage(`Trigger failed for ${this.id}: ${e?.message || e}`)
    }
  }

  // The generic adapter does not implement messaging/tasks by default.
  // These can be added later via per-adapter subclasses or extra config.
}


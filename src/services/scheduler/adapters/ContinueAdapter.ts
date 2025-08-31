import * as vscode from 'vscode'
import { ISchedulerAdapter, ScheduleSummary, TriggerOptions, TaskSummary } from './ISchedulerAdapter'

export class ContinueAdapter implements ISchedulerAdapter {
  public readonly id = 'continue'
  public readonly title = 'Continue'

  private triggerId: string | null = null
  private listId: string | null = null

  async initialize(_context: vscode.ExtensionContext): Promise<void> {
    const cfg = vscode.workspace.getConfiguration('agent-scheduler')
    this.triggerId = cfg.get<string>('experimental.agents.continue.triggerCommand') ?? null
    this.listId = cfg.get<string>('experimental.agents.continue.listCommand') ?? null
  }
  async listSchedules(): Promise<ScheduleSummary[]> { return [] }
  async getActiveCount(): Promise<number> { return 0 }
  async setActive(_scheduleId: string, _active: boolean): Promise<void> {}
  async triggerAgent(opts: TriggerOptions): Promise<void> {
    try {
      const id = this.triggerId || 'continue.open' // best-effort default
      await vscode.commands.executeCommand(id, { text: opts.instructions, mode: opts.mode, metadata: opts.metadata })
    } catch (e) {
      console.warn('ContinueAdapter.triggerAgent failed', e)
    }
  }

  async sendMessage(opts: { channel?: string; text: string; metadata?: Record<string, unknown> }): Promise<{ ok: boolean; data?: any }> {
    try {
      const id = this.triggerId || 'continue.open'
      await vscode.commands.executeCommand(id, { text: opts.text, metadata: opts.metadata })
      return { ok: true }
    } catch (e) { return { ok: false, data: { error: String((e as any)?.message || e) } } }
  }
  async createTask(_opts: { title?: string; params?: Record<string, unknown> }): Promise<{ ok: boolean; task?: TaskSummary }> { return { ok: false } }
  async getTask(_id: string): Promise<{ ok: boolean; task?: TaskSummary }> { return { ok: false } }
  async listTasks(): Promise<{ ok: boolean; tasks: TaskSummary[] }> {
    try {
      if (this.listId) {
        const res = await vscode.commands.executeCommand(this.listId)
        if (Array.isArray(res)) return { ok: true, tasks: res as TaskSummary[] }
      }
    } catch {}
    return { ok: true, tasks: [] }
  }
  async cancelTask(_id: string): Promise<{ ok: boolean }> { return { ok: false } }
}

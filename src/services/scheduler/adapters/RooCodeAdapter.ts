import type * as vscode from 'vscode'
import { ISchedulerAdapter, ScheduleSummary, TriggerOptions, TaskSummary } from './ISchedulerAdapter'

/**
 * Experimental stub for Roo Code adapter. No-op methods for now.
 * TODO: Implement real schedule sync and trigger integration based on Roo Code history.
 */
export class RooCodeAdapter implements ISchedulerAdapter {
  public readonly id = 'roo-code'
  public readonly title = 'Roo Code'

  async initialize(_context: vscode.ExtensionContext): Promise<void> {
    // No-op for now
  }

  async listSchedules(): Promise<ScheduleSummary[]> {
    return []
  }

  async getActiveCount(): Promise<number> {
    return 0
  }

  async setActive(_scheduleId: string, _active: boolean): Promise<void> {
    // No-op
  }

  async triggerAgent(_opts: TriggerOptions): Promise<void> {
    // No-op for now
    return
  }

  async sendMessage(_opts: { channel?: string; text: string; metadata?: Record<string, unknown> }): Promise<{ ok: boolean; data?: any }> { return { ok: true } }
  async createTask(_opts: { title?: string; params?: Record<string, unknown> }): Promise<{ ok: boolean; task?: TaskSummary }> { return { ok: true, task: { id: String(Date.now()), title: _opts.title || 'Task', status: 'pending' } } }
  async getTask(_id: string): Promise<{ ok: boolean; task?: TaskSummary }> { return { ok: false } }
  async listTasks(): Promise<{ ok: boolean; tasks: TaskSummary[] }> { return { ok: true, tasks: [] } }
  async cancelTask(_id: string): Promise<{ ok: boolean }> { return { ok: true } }
}

import type * as vscode from 'vscode'
import { ISchedulerAdapter, ScheduleSummary, TriggerOptions } from './ISchedulerAdapter'

/**
 * Experimental stub for Cline adapter. No-op methods for now.
 * TODO: Implement real schedule sync and trigger integration once API is finalized.
 */
export class ClineAdapter implements ISchedulerAdapter {
  public readonly id = 'cline'
  public readonly title = 'Cline'

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
}


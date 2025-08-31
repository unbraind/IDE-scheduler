import type * as vscode from 'vscode'
import { ISchedulerAdapter, ScheduleSummary, TriggerOptions } from './ISchedulerAdapter'

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
}


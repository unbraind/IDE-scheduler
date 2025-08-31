import type * as vscode from 'vscode'
import { ISchedulerAdapter, ScheduleSummary, TriggerOptions } from './ISchedulerAdapter'

export class GeminiCliAdapter implements ISchedulerAdapter {
  public readonly id = 'geminiCli'
  public readonly title = 'Google Gemini CLI'

  async initialize(_context: vscode.ExtensionContext): Promise<void> {}
  async listSchedules(): Promise<ScheduleSummary[]> { return [] }
  async getActiveCount(): Promise<number> { return 0 }
  async setActive(_scheduleId: string, _active: boolean): Promise<void> {}
  async triggerAgent(_opts: TriggerOptions): Promise<void> { return }
}


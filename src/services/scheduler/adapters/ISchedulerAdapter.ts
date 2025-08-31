import type * as vscode from 'vscode'

export interface ScheduleSummary {
  id: string
  name: string
  active: boolean
  nextExecutionTime?: string
}

export interface TriggerOptions {
  mode?: string
  instructions?: string
  metadata?: Record<string, unknown>
}

export interface ISchedulerAdapter {
  readonly id: string
  readonly title: string
  initialize(context: vscode.ExtensionContext): Promise<void>
  listSchedules(): Promise<ScheduleSummary[]>
  getActiveCount(): Promise<number>
  setActive(scheduleId: string, active: boolean): Promise<void>
  triggerAgent(opts: TriggerOptions): Promise<void>
}


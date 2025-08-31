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

export interface TaskSummary {
  id: string
  title: string
  status: 'pending' | 'running' | 'completed' | 'cancelled' | 'failed' | 'scheduled' | 'inactive'
  details?: Record<string, unknown>
}

export interface ISchedulerAdapter {
  readonly id: string
  readonly title: string
  initialize(context: vscode.ExtensionContext): Promise<void>
  listSchedules(): Promise<ScheduleSummary[]>
  getActiveCount(): Promise<number>
  setActive(scheduleId: string, active: boolean): Promise<void>
  triggerAgent(opts: TriggerOptions): Promise<void>
  // Richer actions used by extended A2A RPCs
  sendMessage?(opts: { channel?: string; text: string; metadata?: Record<string, unknown> }): Promise<{ ok: boolean; data?: any }>
  createTask?(opts: { title?: string; params?: Record<string, unknown> }): Promise<{ ok: boolean; task?: TaskSummary }>
  getTask?(id: string): Promise<{ ok: boolean; task?: TaskSummary }>
  listTasks?(query?: { filter?: string; options?: Record<string, unknown> }): Promise<{ ok: boolean; tasks: TaskSummary[] }>
  cancelTask?(id: string): Promise<{ ok: boolean }>
}

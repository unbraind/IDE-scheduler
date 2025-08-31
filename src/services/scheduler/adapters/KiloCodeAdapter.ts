import * as vscode from 'vscode'
import { SchedulerService } from '../SchedulerService'
import { ISchedulerAdapter, ScheduleSummary, TriggerOptions, TaskSummary } from './ISchedulerAdapter'

export class KiloCodeAdapter implements ISchedulerAdapter {
  public readonly id = 'kilocode'
  public readonly title = 'Kilo Code'
  private initialized = false

  async initialize(context: vscode.ExtensionContext): Promise<void> {
    // Nothing special required for now; ensure SchedulerService is created
    SchedulerService.getInstance(context)
    this.initialized = true
  }

  async listSchedules(): Promise<ScheduleSummary[]> {
    const svc = (SchedulerService as any).instance as SchedulerService | undefined
    if (!svc) return []
    // Access schedules via a lightweight accessor if present; fall back to file if needed later
    const summaries: ScheduleSummary[] = (svc as any).schedules?.map((s: any) => ({
      id: s.id,
      name: s.name,
      active: s.active !== false,
      nextExecutionTime: s.nextExecutionTime,
    })) ?? []
    return summaries
  }

  async getActiveCount(): Promise<number> {
    const svc = (SchedulerService as any).instance as SchedulerService | undefined
    if (!svc) return 0
    return (svc as any).getActiveScheduleCount?.() ?? 0
  }

  async setActive(scheduleId: string, active: boolean): Promise<void> {
    const svc = (SchedulerService as any).instance as SchedulerService | undefined
    if (!svc) return
    if ((svc as any).toggleScheduleActive) {
      await (svc as any).toggleScheduleActive(scheduleId, active)
    } else if ((svc as any).updateSchedule) {
      await (svc as any).updateSchedule(scheduleId, { active })
    }
  }

  async triggerAgent(opts: TriggerOptions): Promise<void> {
    // Fire a command or message that Kilo Code understands. For now, focus the sidebar and send a hint.
    try {
      try {
        await vscode.commands.executeCommand('agent-scheduler.SidebarProvider.focus')
      } catch {
        await vscode.commands.executeCommand('kilo-scheduler.SidebarProvider.focus')
      }
      // Send a message to our webview if available (best-effort)
      try {
        await vscode.commands.executeCommand('agent-scheduler.handleHumanRelayResponse', {
          action: 'triggerAgent',
          mode: opts.mode,
          instructions: opts.instructions,
          metadata: opts.metadata,
        })
      } catch {
        await vscode.commands.executeCommand('kilo-scheduler.handleHumanRelayResponse', {
        action: 'triggerAgent',
        mode: opts.mode,
        instructions: opts.instructions,
        metadata: opts.metadata,
        })
      }
    } catch (e) {
      // Swallow failures gracefully; this is experimental
      console.warn('KiloCodeAdapter.triggerAgent failed', e)
    }
  }

  async sendMessage(opts: { channel?: string; text: string; metadata?: Record<string, unknown> }): Promise<{ ok: boolean; data?: any }> {
    try {
      await vscode.commands.executeCommand('agent-scheduler.handleHumanRelayResponse', {
        action: 'message',
        channel: opts.channel,
        text: opts.text,
        metadata: opts.metadata,
      })
      return { ok: true }
    } catch (e) {
      console.warn('KiloCodeAdapter.sendMessage failed', e)
      return { ok: false, data: { error: String((e as any)?.message || e) } }
    }
  }

  async createTask(opts: { title?: string; params?: Record<string, unknown> }): Promise<{ ok: boolean; task?: TaskSummary }> {
    // For now, a lightweight immediate-trigger treated as a task descriptor
    try {
      await this.triggerAgent({ mode: String(opts?.params?.mode || ''), instructions: String(opts?.params?.instructions || ''), metadata: opts?.params })
      const task: TaskSummary = { id: String(Date.now()), title: opts.title || 'Immediate Task', status: 'completed', details: opts.params }
      return { ok: true, task }
    } catch (e) {
      return { ok: false }
    }
  }

  async getTask(id: string): Promise<{ ok: boolean; task?: TaskSummary }> {
    // Map to schedule when possible
    const svc = (SchedulerService as any).instance as SchedulerService | undefined
    if (!svc) return { ok: false }
    const schedules: any[] = (svc as any).schedules ?? []
    const s = schedules.find((x) => String(x.id) === String(id))
    if (!s) return { ok: false }
    const task: TaskSummary = { id: s.id, title: s.name, status: s.active !== false ? 'scheduled' : 'inactive', details: { nextExecutionTime: s.nextExecutionTime } }
    return { ok: true, task }
  }

  async listTasks(): Promise<{ ok: boolean; tasks: TaskSummary[] }> {
    const svc = (SchedulerService as any).instance as SchedulerService | undefined
    if (!svc) return { ok: true, tasks: [] }
    const schedules: any[] = (svc as any).schedules ?? []
    const tasks: TaskSummary[] = schedules.map((s) => ({ id: s.id, title: s.name, status: s.active !== false ? 'scheduled' : 'inactive', details: { nextExecutionTime: s.nextExecutionTime } }))
    return { ok: true, tasks }
  }

  async cancelTask(id: string): Promise<{ ok: boolean }> {
    const svc = (SchedulerService as any).instance as SchedulerService | undefined
    if (!svc) return { ok: false }
    if ((svc as any).updateSchedule) {
      await (svc as any).updateSchedule(id, { active: false })
      return { ok: true }
    }
    return { ok: false }
  }
}

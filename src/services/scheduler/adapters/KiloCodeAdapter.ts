import * as vscode from 'vscode'
import { SchedulerService } from '../SchedulerService'
import { ISchedulerAdapter, ScheduleSummary, TriggerOptions } from './ISchedulerAdapter'

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
      await vscode.commands.executeCommand('kilo-scheduler.SidebarProvider.focus')
      // Send a message to our webview if available (best-effort)
      await vscode.commands.executeCommand('kilo-scheduler.handleHumanRelayResponse', {
        action: 'triggerAgent',
        mode: opts.mode,
        instructions: opts.instructions,
        metadata: opts.metadata,
      })
    } catch (e) {
      // Swallow failures gracefully; this is experimental
      console.warn('KiloCodeAdapter.triggerAgent failed', e)
    }
  }
}

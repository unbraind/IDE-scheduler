import * as vscode from 'vscode'
import { ISchedulerAdapter, ScheduleSummary, TriggerOptions, TaskSummary } from './ISchedulerAdapter'
import { AdapterA2AClient } from './AdapterA2AClient'

export abstract class SpecializedAdapterBase implements ISchedulerAdapter {
  abstract readonly id: string
  abstract readonly title: string
  protected triggerId: string | null = null
  protected listId: string | null = null
  protected httpBase: string | null = null
  protected grpcTarget: string | null = null
  protected token: string | null = null

  async initialize(_context: vscode.ExtensionContext): Promise<void> {
    const cfg = vscode.workspace.getConfiguration('agent-scheduler')
    const key = `experimental.agents.${this.id}`
    this.triggerId = cfg.get<string>(`${key}.triggerCommand`) ?? null
    this.listId = cfg.get<string>(`${key}.listCommand`) ?? null
    this.httpBase = cfg.get<string>(`${key}.a2a.http.base`) ?? null
    this.grpcTarget = cfg.get<string>(`${key}.a2a.grpc.target`) ?? null
    this.token = cfg.get<string>(`${key}.a2a.authToken`) ?? null
  }

  protected async client(): Promise<AdapterA2AClient | null> {
    if (!this.httpBase) return null
    return new AdapterA2AClient(this.httpBase)
  }

  async listSchedules(): Promise<ScheduleSummary[]> { return [] }
  async getActiveCount(): Promise<number> { const r = await this.listTasks(); return r.tasks?.filter(t=>t.status==='scheduled' || t.status==='running').length || 0 }
  async setActive(_scheduleId: string, _active: boolean): Promise<void> {}

  async triggerAgent(opts: TriggerOptions): Promise<void> {
    // Prefer A2A invoke when configured
    try {
      const c = await this.client()
      if (c) { await c.invoke({ protocol:'a2a', version:'1', target:{ agent: this.id }, action:'trigger', payload:{ instructions: opts.instructions, mode: opts.mode, metadata: opts.metadata } }, this.token || undefined); return }
    } catch {}
    // Fallback to command
    if (this.triggerId) {
      try { await vscode.commands.executeCommand(this.triggerId, { text: opts.instructions, mode: opts.mode, metadata: opts.metadata }) } catch {}
    }
  }

  async sendMessage(opts: { channel?: string; text: string; metadata?: Record<string, unknown> }) { try { const c = await this.client(); if (c) return await c.message({ target:{ agent:this.id }, channel: opts.channel, text: opts.text, metadata: opts.metadata }, this.token || undefined); } catch {}; return { ok:false } }
  async createTask(opts: { title?: string; params?: Record<string, unknown> }) { try { const c = await this.client(); if (c) return await c.createTask({ target:{ agent:this.id }, title: opts.title, params: opts.params }, this.token || undefined) } catch {}; return { ok:false } }
  async getTask(id: string) { try { const c = await this.client(); if (c) return await c.getTask({ target:{ agent:this.id }, id }, this.token || undefined) } catch {}; return { ok:false } }
  async listTasks(_args?: any): Promise<{ ok: boolean; tasks: TaskSummary[] }> { try { const c = await this.client(); if (c) { const r = await c.listTasks({ target:{ agent:this.id } }, this.token || undefined); return { ok: !!r?.ok, tasks: r?.tasks || [] } } } catch {}; return { ok:true, tasks: [] } }
  async cancelTask(id: string) { try { const c = await this.client(); if (c) return await c.cancelTask({ target:{ agent:this.id }, id }, this.token || undefined) } catch {}; return { ok:false } }
}


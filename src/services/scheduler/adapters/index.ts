import * as vscode from 'vscode'
import { ISchedulerAdapter } from './ISchedulerAdapter'
import { KiloCodeAdapter } from './KiloCodeAdapter'
import { ClineAdapter } from './ClineAdapter'
import { RooCodeAdapter } from './RooCodeAdapter'

export class SchedulerAdapterRegistry {
  private static _instance: SchedulerAdapterRegistry
  private adapters = new Map<string, ISchedulerAdapter>()
  private initialized = false

  static instance(): SchedulerAdapterRegistry {
    if (!this._instance) this._instance = new SchedulerAdapterRegistry()
    return this._instance
  }

  async initialize(context: vscode.ExtensionContext) {
    if (this.initialized) return
    // Register built-in Kilo Code adapter first
    const kilo = new KiloCodeAdapter()
    this.adapters.set(kilo.id, kilo)
    await kilo.initialize(context)
    // Conditionally register experimental adapters
    const crossIde = vscode.workspace.getConfiguration('kilo-scheduler').get<boolean>('experimental.crossIde') ?? false
    if (crossIde) {
      const cline = new ClineAdapter()
      const roo = new RooCodeAdapter()
      this.adapters.set(cline.id, cline)
      this.adapters.set(roo.id, roo)
      await Promise.all([cline.initialize(context), roo.initialize(context)])
    }
    this.initialized = true
  }

  get(id: string): ISchedulerAdapter | undefined {
    return this.adapters.get(id)
  }

  all(): ISchedulerAdapter[] {
    return [...this.adapters.values()]
  }
}

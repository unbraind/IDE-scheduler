import { ISchedulerAdapter } from './ISchedulerAdapter'
import { SpecializedAdapterBase } from './SpecializedAdapterBase'

export class CopilotAdapter extends SpecializedAdapterBase implements ISchedulerAdapter {
  public readonly id = 'copilot'
  public readonly title = 'GitHub Copilot'
}


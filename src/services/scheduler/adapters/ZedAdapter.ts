import { ISchedulerAdapter } from './ISchedulerAdapter'
import { SpecializedAdapterBase } from './SpecializedAdapterBase'

export class ZedAdapter extends SpecializedAdapterBase implements ISchedulerAdapter {
  public readonly id = 'zed'
  public readonly title = 'Zed IDE'
}


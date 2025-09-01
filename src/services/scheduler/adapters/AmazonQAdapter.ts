import { ISchedulerAdapter } from './ISchedulerAdapter'
import { SpecializedAdapterBase } from './SpecializedAdapterBase'

export class AmazonQAdapter extends SpecializedAdapterBase implements ISchedulerAdapter {
  public readonly id = 'amazonQ'
  public readonly title = 'Amazon Q'
}


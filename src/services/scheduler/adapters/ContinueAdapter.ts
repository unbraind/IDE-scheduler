import * as vscode from 'vscode'
import { ISchedulerAdapter, ScheduleSummary, TriggerOptions, TaskSummary } from './ISchedulerAdapter'
import { SpecializedAdapterBase } from './SpecializedAdapterBase'

export class ContinueAdapter extends SpecializedAdapterBase implements ISchedulerAdapter {
  public readonly id = 'continue'
  public readonly title = 'Continue'
}

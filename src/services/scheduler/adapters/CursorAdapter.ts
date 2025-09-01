import * as vscode from 'vscode'
import { ISchedulerAdapter, ScheduleSummary, TriggerOptions, TaskSummary } from './ISchedulerAdapter'
import { SpecializedAdapterBase } from './SpecializedAdapterBase'

export class CursorAdapter extends SpecializedAdapterBase implements ISchedulerAdapter {
  public readonly id = 'cursor'
  public readonly title = 'Cursor'
  // Inherits full A2A-aware implementations; provide any Cursor-specific overrides later
}

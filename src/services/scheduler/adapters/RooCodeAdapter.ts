import type * as vscode from 'vscode'
import { ISchedulerAdapter, ScheduleSummary, TriggerOptions, TaskSummary } from './ISchedulerAdapter'
import { SpecializedAdapterBase } from './SpecializedAdapterBase'

/**
 * Experimental stub for Roo Code adapter. No-op methods for now.
 * TODO: Implement real schedule sync and trigger integration based on Roo Code history.
 */
export class RooCodeAdapter extends SpecializedAdapterBase implements ISchedulerAdapter {
  public readonly id = 'rooCode'
  public readonly title = 'Roo Code'
}


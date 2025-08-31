import * as vscode from 'vscode';
import { KiloCodeAPI } from '../../kilo-code';

/**
 * Service for interacting with the Kilo Code extension.
 */
export class KiloService {
  /**
   * Starts a new task in the Kilo Code extension with the specified mode and instructions.
   * @param mode The mode slug to use.
   * @param taskInstructions The instructions for the task.
   * @throws Error if the Kilo Code extension or its API is not available.
  */
  /**
   * Starts a new task in the Kilo Code extension with the specified mode and instructions.
   * @param mode The mode slug to use.
   * @param taskInstructions The instructions for the task.
   * @returns The ID of the new task.
   * @throws Error if the Kilo Code extension or its API is not available.
  */
  public static async startTaskWithMode(mode: string, taskInstructions: string): Promise<string> {
    const api = KiloService.getKiloCodeApi();
    console.log('got api', api);
    // Get the current configuration
    const config = api.getConfiguration();
    console.log('got config', config);

    // Set the mode in the configuration
    const updatedConfig = {
      ...config,
      mode,
      customModePrompts: config.customModePrompts || {}
    };
    console.log(updatedConfig)

    // Start a new task with the specified mode and instructions, and return the task ID
    const taskId = await api.startNewTask({
      configuration: updatedConfig,
      text: taskInstructions
    });
    console.log('got taskId', taskId);
    return taskId;
  }

  /**
   * Gets the Kilo Code API instance, or throws if not available.
   * @private
   */
  private static getKiloCodeApi() {
    const extension = vscode.extensions.getExtension<KiloCodeAPI>("kilocode.kilo-code");
    if (!extension?.isActive) {
      throw new Error("Kilo Code extension is not activated");
    }
    const api = extension.exports;
    if (!api) {
      throw new Error("Kilo Code API is not available");
    }
    return api;
  }

  /**
   * Returns the task history array from the Roo Cline API configuration,
   * or undefined if there is no active task stack or no history.
   * @private
   */
  private static getTaskHistoryAndStack(): {taskHistory: any[], taskStack: string[]} {
    const api = KiloService.getKiloCodeApi();
    const taskStack = api.getCurrentTaskStack();

    const config = api.getConfiguration();
    const taskHistory = config.taskHistory || [];
    
    return {taskHistory,taskStack};
  }

  /**
   * Gets the timestamp of the last activity on the active task.
   * @returns The timestamp (ms since epoch) of the last activity, or undefined if not found.
   */
  public static async getLastActivityTimeForActiveTask(): Promise<number | undefined> {
    const {taskStack, taskHistory} = this.getTaskHistoryAndStack();
    if (!taskStack || taskStack.length === 0) {
      return undefined;
    }
    const activeTaskId = taskStack[taskStack.length - 1];
   
    // Find the last entry for the active task (most recent message)
    const activeTaskEntries = taskHistory.filter((entry: any) => entry.id === activeTaskId);
    if (!activeTaskEntries.length) {
      return undefined;
    }
    return activeTaskEntries[activeTaskEntries.length - 1].ts;
  }

  /**
   * Gets the timestamp of the last activity, excluding a specific task if provided.
   * @returns The timestamp (ms since epoch) of the last activity, or undefined if not found.
   */
  public static async getLastActivityTime(excludedTaskId?: string): Promise<number | undefined> {
    let {taskHistory} = KiloService.getTaskHistoryAndStack();
    if (!taskHistory) {
      return undefined;
    }
    if (excludedTaskId) {
      taskHistory = taskHistory.filter((entry: any) => entry.id !== excludedTaskId);
    }
    if (!taskHistory.length) {
      return undefined;
    }
    return taskHistory[taskHistory.length - 1].ts;
  }

  /**
   * Checks if there is an active task with activity within the given duration.
   * @param durationMs The duration in milliseconds.
   * @returns Promise<boolean> - true if there is an active task and its most recent activity is within the duration from now, otherwise false.
   */
  public static async isActiveTaskWithinDuration(durationMs: number): Promise<boolean> {
    const lastActivityTime = await KiloService.getLastActivityTimeForActiveTask();
    if (!lastActivityTime) {
      return false;
    }
    const now = Date.now();
    return now - lastActivityTime <= durationMs;
  }

  /**
   * Checks if there is an active task running.
   * @returns Promise<boolean> - true if there is an active task, otherwise false.
   */
  public static async hasActiveTask(): Promise<boolean> {
    const api = KiloService.getKiloCodeApi();
    const taskStack = api.getCurrentTaskStack();
    return !!taskStack && taskStack.length > 0;
  }

  /**
   * Interrupts the current active task, if any.
   * @returns Promise<boolean> - true if a task was interrupted, false if no active task.
   */
  public static async interruptActiveTask(): Promise<boolean> {
    const api = KiloService.getKiloCodeApi();
    const taskStack = api.getCurrentTaskStack();
    
    if (!taskStack || taskStack.length === 0) {
      return false;
    }
    
    // Cancel the current task
    await api.cancelCurrentTask();
    return true;
  }
  
  /**
   * Resumes a task with the given ID and opens the Kilo Code extension.
   * @param taskId The ID of the task to resume.
   * @returns Promise<void>
   * @throws Error if the task is not found in the task history or the Kilo Code extension is not available.
  */
  public static async resumeTask(taskId: string): Promise<void> {
    console.log(`KiloService.resumeTask called with taskId: ${taskId}`);
    
    if (!taskId) {
      console.error("Task ID is empty or undefined");
      throw new Error("Task ID is required to resume a task");
    }
  
    console.log("Getting Kilo Code API...");
    const api = KiloService.getKiloCodeApi();
    console.log("Kilo Code API obtained successfully");
    
    try {
      // First, check if the task exists in history
      console.log("Checking if task exists in history...");
      const exists = await api.isTaskInHistory(taskId);
      if (!exists) {
        console.error(`Task with ID ${taskId} not found in history`);
        throw new Error(`Task with ID ${taskId} not found in history`);
      }
      console.log(`Task with ID ${taskId} found in history`);
      
      // Try different approaches to open the Kilo Code extension
      try {
        // First try the direct command
        console.log("Opening Kilo Code extension via direct command...");
        await vscode.commands.executeCommand("kilo-code.SidebarProvider.focus");
      } catch (cmdError) {
        console.error("Error opening Kilo Code extension via direct command:", cmdError);
        
        // Try the registered command in our extension
        try {
          console.log("Opening Kilo Code extension via our registered command...");
          await vscode.commands.executeCommand("kilo-scheduler.openKiloCodeExtension");
        } catch (regCmdError) {
          console.error("Error opening Kilo Code extension via registered command:", regCmdError);
          // Continue anyway, as the resumeTask might still work
        }
      }
      
      // Resume the task
      console.log(`Resuming task with ID: ${taskId}...`);
      await api.resumeTask(taskId);
      console.log("Task resumed successfully");
      
      // Show a notification to the user
      vscode.window.showInformationMessage(`Task ${taskId} resumed successfully`);
    } catch (error) {
      console.error("Error in resumeTask:", error);
      throw error;
    }
  }
}

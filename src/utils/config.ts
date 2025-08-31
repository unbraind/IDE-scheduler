import * as vscode from 'vscode'

const NEW_SECTION = 'agent-scheduler'
const LEGACY_SECTION = 'kilo-scheduler'

export function getConfig(section?: string) {
  return vscode.workspace.getConfiguration(section ?? NEW_SECTION)
}

export function getSetting<T>(key: string, defaultValue?: T): T | undefined {
  // Try new key first
  const newVal = vscode.workspace.getConfiguration(NEW_SECTION).get<T>(key)
  if (newVal !== undefined && newVal !== null) return newVal
  // Fallback to legacy section
  return vscode.workspace.getConfiguration(LEGACY_SECTION).get<T>(key, defaultValue as any)
}

export function setSetting<T>(key: string, value: T, target: vscode.ConfigurationTarget = vscode.ConfigurationTarget.Global) {
  return vscode.workspace.getConfiguration(NEW_SECTION).update(key, value, target)
}


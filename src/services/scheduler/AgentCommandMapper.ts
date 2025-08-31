import * as vscode from 'vscode'

export type AgentCommandMapping = {
  agent: string
  extensionId?: string
  triggerCommand?: string
  listCommand?: string
}

const KNOWN_AGENT_HINTS: Record<string, { keywords: string[] }> = {
  cline: { keywords: ['cline'] },
  'roo-code': { keywords: ['roo', 'roo-code'] },
  continue: { keywords: ['continue'] },
  cursor: { keywords: ['cursor'] },
  claudeCode: { keywords: ['claude', 'anthropic'] },
  geminiCli: { keywords: ['gemini'] },
  qwenCli: { keywords: ['qwen'] },
}

function isLikelyAgent(ext: vscode.Extension<any>, agent: string): boolean {
  const pkg: any = (ext as any).packageJSON || {}
  const id = (ext.id || '').toLowerCase()
  const name = (pkg.displayName || pkg.name || '').toLowerCase()
  const keywords = (pkg.keywords || []).map((k: string) => String(k).toLowerCase())
  const hints = KNOWN_AGENT_HINTS[agent]
  if (!hints) return false
  return hints.keywords.some((k) => id.includes(k) || name.includes(k) || keywords.includes(k))
}

export async function discoverAgentCommands(): Promise<AgentCommandMapping[]> {
  const mappings: AgentCommandMapping[] = []
  for (const agent of Object.keys(KNOWN_AGENT_HINTS)) {
    const mapping: AgentCommandMapping = { agent }
    const candidates = vscode.extensions.all.filter((e) => isLikelyAgent(e, agent))
    if (candidates.length > 0) {
      const ext = candidates[0]
      const pkg: any = (ext as any).packageJSON || {}
      mapping.extensionId = ext.id
      const cmds: any[] = (pkg.contributes && pkg.contributes.commands) || []
      // Heuristic: prefer commands with 'new'+'task' or 'chat' for trigger
      const trigger = cmds.find((c) => typeof c.command === 'string' && /new.*task|start|chat|trigger/i.test(c.command))
      if (trigger) mapping.triggerCommand = trigger.command
      const list = cmds.find((c) => typeof c.command === 'string' && /list|schedules|history|tasks/i.test(c.command))
      if (list) mapping.listCommand = list.command
    }
    mappings.push(mapping)
  }
  return mappings
}


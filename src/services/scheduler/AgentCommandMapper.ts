import * as vscode from 'vscode'

export type AgentCommandMapping = {
  agent: string
  extensionId?: string
  triggerCommand?: string
  listCommand?: string
}

const KNOWN_AGENT_HINTS: Record<string, { keywords: string[] }> = {
  // VS Code extensions or likely matches
  cline: { keywords: ['cline'] },
  'roo-code': { keywords: ['roo', 'roo-code', 'kilo', 'kilo-code'] },
  continue: { keywords: ['continue'] },
  cursor: { keywords: ['cursor'] },
  claudeCode: { keywords: ['claude', 'anthropic'] },
  geminiCli: { keywords: ['gemini', 'gemini cli', 'google generative ai'] },
  qwenCli: { keywords: ['qwen', 'qwen coder', 'alibaba'] },
  copilot: { keywords: ['copilot', 'github copilot'] },
  amazonQ: { keywords: ['amazon q', 'codewhisperer', 'aws toolkit'] },
  augmentCode: { keywords: ['augment', 'augment code'] },
  googleCodeAssist: { keywords: ['code assist', 'google code assist'] },
  codexCli: { keywords: ['codex cli', 'codex online'] },
  windsail: { keywords: ['windsurf', 'windsurf plugin'] },
  qodoGen: { keywords: ['qodo', 'qodo gen'] },
  qoder: { keywords: ['qoder'] },
  zed: { keywords: ['zed ide'] }, // not a VS Code extension; will likely not be discovered
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
      const trigger = cmds.find((c) => typeof c.command === 'string' && /new.*task|start|chat|trigger|open|create/i.test(c.command))
      if (trigger) mapping.triggerCommand = trigger.command
      const list = cmds.find((c) => typeof c.command === 'string' && /list|schedules|history|tasks|show|view/i.test(c.command))
      if (list) mapping.listCommand = list.command
    }
    mappings.push(mapping)
  }
  return mappings
}

export async function persistDiscoveredAgentCommands(mappings: AgentCommandMapping[]): Promise<void> {
  const cfg = vscode.workspace.getConfiguration('agent-scheduler')
  for (const m of mappings) {
    if (!m.agent) continue
    const triggerKey = `experimental.agents.${m.agent}.triggerCommand`
    const listKey = `experimental.agents.${m.agent}.listCommand`
    const curTrigger = cfg.get<string>(triggerKey)
    const curList = cfg.get<string>(listKey)
    if (!curTrigger && m.triggerCommand) await cfg.update(triggerKey, m.triggerCommand, true)
    if (!curList && m.listCommand) await cfg.update(listKey, m.listCommand, true)
  }
}

import * as vscode from 'vscode'
import { getSetting } from '../../utils/config'

export async function sendA2AOverMCP(message: any): Promise<{ ok: boolean; error?: string }> {
  try {
    const enabled = getSetting<boolean>('experimental.mcp.enabled') ?? false
    const forward = getSetting<boolean>('experimental.mcp.forward') ?? false
    const endpoint = getSetting<string>('experimental.mcp.endpoint') ?? ''
    if (!enabled || !forward) return { ok: false, error: 'mcp-disabled' }
    if (!endpoint) return { ok: false, error: 'endpoint-missing' }

    // Best-effort call via MCP SDK (mocked in tests); keep lightweight to avoid bundling issues
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const mcp = require('@modelcontextprotocol/sdk')
    if (mcp && typeof mcp.send === 'function') {
      await mcp.send(endpoint, message)
      return { ok: true }
    }
    return { ok: false, error: 'sdk-not-available' }
  } catch (err) {
    console.warn('sendA2AOverMCP failed', err)
    return { ok: false, error: 'exception' }
  }
}

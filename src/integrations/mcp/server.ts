import * as vscode from 'vscode'
import { handleA2ATrigger } from '../../protocols/a2a'
import { getSetting } from '../../utils/config'

// Minimal stub scaffolding for an MCP endpoint. This is guarded by settings and
// will no-op if the SDK is unavailable. The intent is to expose a tool
// (e.g., a2a.invoke) that forwards to handleA2ATrigger.

let started = false

export async function startMcpA2AEndpoint(_context: vscode.ExtensionContext) {
  try {
    const enabled = getSetting<boolean>('experimental.mcp.enabled') ?? false
    if (!enabled || started) return
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const mcp = require('@modelcontextprotocol/sdk')
    if (!mcp) return
    // NOTE: Actual server transport selection (stdio/websocket) and registration
    // details depend on the hosting and SDK specifics. This scaffolding
    // intentionally avoids hard-coding transports.
    if (typeof mcp.exposeTool === 'function') {
      await mcp.exposeTool('a2a.invoke', async (input: any) => {
        return await handleA2ATrigger(input)
      })
      started = true
    }
  } catch (e) {
    console.warn('MCP A2A endpoint failed to start', e)
  }
}


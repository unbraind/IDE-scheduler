import * as http from 'http'
import { startMcpA2AEndpoint, stopMcpA2AEndpoint } from '../integrations/mcp/server'
import * as vscode from 'vscode'

// Mock configuration to enable MCP HTTP endpoint
jest.mock('../utils/config', () => ({
  getSetting: (k: string) => {
    if (k === 'experimental.mcp.enabled') return true
    if (k === 'experimental.mcp.http.enabled') return true
    if (k === 'experimental.mcp.http.port') return 4099
    if (k === 'experimental.mcp.http.path') return '/mcp'
    return undefined
  },
}))

// Minimal mock MCP server + transport
const toolHandlers: Record<string, (args: any) => Promise<any>> = {}
jest.mock('@modelcontextprotocol/sdk', () => ({
  McpServer: class {
    constructor(_opts: any) {}
    tool(name: string, { handler }: any) { toolHandlers[name] = handler }
  },
}))
jest.mock('@modelcontextprotocol/sdk/server/stream', () => ({
  StreamableHTTPServerTransport: class {
    async handleRequest(_server: any, _req: http.IncomingMessage, res: http.ServerResponse, body: any) {
      // Simulate MCP payload: direct JSON args for our test
      const parsed = JSON.parse(body || '{}')
      const result = await toolHandlers['a2a.invoke']?.(parsed)
      const text = (result?.content?.[0]?.text) || JSON.stringify({ ok: false })
      res.writeHead(200, { 'content-type': 'application/json' })
      res.end(text)
    }
  },
}))

// Mock A2A handler
jest.mock('../protocols/a2a', () => ({
  handleA2ATrigger: async (_: any) => ({ ok: true, data: { echo: true } }),
}))

describe('MCP HTTP endpoint', () => {
  afterEach(() => { stopMcpA2AEndpoint() })
  test('exposes a2a.invoke over HTTP and returns JSON', async () => {
    const context = { subscriptions: [] } as unknown as vscode.ExtensionContext
    await startMcpA2AEndpoint(context)
    const payload = JSON.stringify({ protocol: 'a2a', version: '1', target: { agent: 'kilocode' }, action: 'trigger' })
    const res = await new Promise<string>((resolve, reject) => {
      const req = http.request({ hostname: '127.0.0.1', port: 4099, path: '/mcp', method: 'POST' }, (r) => {
        const chunks: Buffer[] = []
        r.on('data', c => chunks.push(Buffer.isBuffer(c) ? c : Buffer.from(c)))
        r.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')))
      })
      req.on('error', reject)
      req.end(payload)
    })
    expect(res).toContain('ok')
  })
})


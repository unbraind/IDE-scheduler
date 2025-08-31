import * as http from 'http'
import * as vscode from 'vscode'
import { z } from 'zod'
import { handleA2ATrigger } from '../../protocols/a2a'
import { getSetting } from '../../utils/config'

// Expose an MCP server (HTTP streaming) with a single tool `a2a.invoke` that
// forwards to our internal A2A handler. This follows the MCP server API from
// @modelcontextprotocol/sdk v1.7+.

let started = false
let httpServer: http.Server | null = null

export async function startMcpA2AEndpoint(_context: vscode.ExtensionContext) {
  try {
    const enabled = getSetting<boolean>('experimental.mcp.enabled') ?? false
    const httpEnabled = getSetting<boolean>('experimental.mcp.http.enabled') ?? false
    if (!enabled || !httpEnabled || started) return

    // Lazy require to avoid bundling when disabled
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { McpServer } = require('@modelcontextprotocol/sdk')
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { StreamableHTTPServerTransport } = require('@modelcontextprotocol/sdk/server/stream')

    if (!McpServer || !StreamableHTTPServerTransport) return

    const port = getSetting<number>('experimental.mcp.http.port') ?? 4025
    const route = getSetting<string>('experimental.mcp.http.path') ?? '/mcp'

    const server = new McpServer({ name: 'agent-scheduler-mcp' })

    // Define tool schema with zod for validation (loosely matches our A2A shape)
    const inputSchema = z.object({
      protocol: z.literal('a2a'),
      version: z.string().default('1'),
      target: z.object({ agent: z.string() }),
      action: z.enum(['trigger', 'list', 'setActive']),
      payload: z.record(z.any()).optional(),
    })

    server.tool('a2a.invoke', {
      description: 'Invoke an Agent-to-Agent (A2A) action within Agent Scheduler',
      inputSchema,
      handler: async (args: unknown) => {
        const parsed = inputSchema.parse(args)
        const res = await handleA2ATrigger(parsed)
        return { content: [{ type: 'text', text: JSON.stringify(res) }] }
      },
    })

    const transport = new StreamableHTTPServerTransport()

    httpServer = http.createServer((req, res) => {
      try {
        if (!req.url || !req.method) return res.end()
        if (!req.url.startsWith(route)) return res.writeHead(404).end()
        const chunks: Buffer[] = []
        req.on('data', (c) => chunks.push(Buffer.isBuffer(c) ? c : Buffer.from(c)))
        req.on('end', () => {
          const body = Buffer.concat(chunks).toString('utf8')
          // Do not await; this is a callback-based HTTP handler
          void transport.handleRequest(server, req, res, body)
        })
      } catch (e: any) {
        console.warn('MCP HTTP handler error', e?.message || e)
        try { res.writeHead(500).end('MCP error') } catch {}
      }
      // Satisfy noImplicitReturns for certain TS resolver paths
      return undefined as unknown as void
    })
    httpServer.listen(port, '127.0.0.1', () => {
      started = true
      console.log(`MCP A2A endpoint listening on http://127.0.0.1:${port}${route}`)
    })
  } catch (e) {
    console.warn('MCP A2A endpoint failed to start', e)
  }
}

export function stopMcpA2AEndpoint() {
  try { httpServer?.close() } catch {}
  httpServer = null
  started = false
}

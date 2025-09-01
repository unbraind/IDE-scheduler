import * as http from 'http'
import * as vscode from 'vscode'
import { z } from 'zod'
import { handleA2ATrigger } from '../../protocols/a2a'
import { authorize } from '../../security/auth'
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

    // Define tool schemas with zod for validation (loosely match our A2A shapes)
    const invokeSchema = z.object({
      protocol: z.literal('a2a'),
      version: z.string().default('1'),
      target: z.object({ agent: z.string() }),
      action: z.enum(['trigger', 'list', 'setActive']),
      payload: z.record(z.any()).optional(),
    })

    server.tool('a2a.invoke', {
      description: 'Invoke an Agent-to-Agent (A2A) action within Agent Scheduler',
      inputSchema: invokeSchema,
      handler: async (args: unknown) => {
        const parsed = invokeSchema.parse(args)
        const res = await handleA2ATrigger(parsed)
        return { content: [{ type: 'text', text: JSON.stringify(res) }] }
      },
    })

    // Messaging tool
    const messageSchema = z.object({
      target: z.object({ agent: z.string() }),
      channel: z.string().optional(),
      text: z.string(),
      metadata: z.record(z.any()).optional(),
    })
    server.tool('a2a.message', {
      description: 'Send a message to an agent via Agent Scheduler',
      inputSchema: messageSchema,
      handler: async (args: unknown) => {
        const { target, channel, text, metadata } = messageSchema.parse(args)
        const res = await (await import('../../protocols/a2a')).handleSendMessage({ agent: target.agent, channel, text, metadata })
        return { content: [{ type: 'text', text: JSON.stringify(res) }] }
      },
    })

    // Task tools
    const createTaskSchema = z.object({ target: z.object({ agent: z.string() }), title: z.string().optional(), params: z.record(z.any()).optional() })
    server.tool('a2a.task.create', {
      description: 'Create a task via Agent Scheduler',
      inputSchema: createTaskSchema,
      handler: async (args: unknown) => {
        const { target, title, params } = createTaskSchema.parse(args)
        const res = await (await import('../../protocols/a2a')).handleCreateTask({ agent: target.agent, title, params })
        return { content: [{ type: 'text', text: JSON.stringify(res) }] }
      },
    })
    const getTaskSchema = z.object({ target: z.object({ agent: z.string() }), id: z.string() })
    server.tool('a2a.task.get', {
      description: 'Get a task via Agent Scheduler',
      inputSchema: getTaskSchema,
      handler: async (args: unknown) => {
        const { target, id } = getTaskSchema.parse(args)
        const res = await (await import('../../protocols/a2a')).handleGetTask({ agent: target.agent, id })
        return { content: [{ type: 'text', text: JSON.stringify(res) }] }
      },
    })
    const listTaskSchema = z.object({ target: z.object({ agent: z.string() }), filter: z.string().optional(), options: z.record(z.any()).optional() })
    server.tool('a2a.task.list', {
      description: 'List tasks via Agent Scheduler',
      inputSchema: listTaskSchema,
      handler: async (args: unknown) => {
        const { target, filter, options } = listTaskSchema.parse(args)
        const res = await (await import('../../protocols/a2a')).handleListTasks({ agent: target.agent, filter, options })
        return { content: [{ type: 'text', text: JSON.stringify(res) }] }
      },
    })
    const cancelTaskSchema = z.object({ target: z.object({ agent: z.string() }), id: z.string() })
    server.tool('a2a.task.cancel', {
      description: 'Cancel a task via Agent Scheduler',
      inputSchema: cancelTaskSchema,
      handler: async (args: unknown) => {
        const { target, id } = cancelTaskSchema.parse(args)
        const res = await (await import('../../protocols/a2a')).handleCancelTask({ agent: target.agent, id })
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
        req.on('end', async () => {
          const body = Buffer.concat(chunks).toString('utf8')
          // Optional auth for MCP HTTP
          try {
            const required = getSetting<boolean>('experimental.auth.mcp.required') ?? false
            if (required) {
              const tok = (req.headers['authorization'] as string) || (req.headers['x-agent-key'] as string)
              const { ok } = await authorize((global as any).__extensionContext, 'mcp', 'invoke', tok)
              if (!ok) { try { res.writeHead(401).end('Unauthorized') } catch {}; return }
            }
          } catch {}
          // Forward to MCP SDK transport
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

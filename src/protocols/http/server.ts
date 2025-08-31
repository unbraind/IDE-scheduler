import * as http from 'http'
import * as vscode from 'vscode'
import { getSetting } from '../../utils/config'
import { handleA2ATrigger, handleSendMessage, handleCreateTask, handleGetTask, handleListTasks, handleCancelTask } from '../a2a'
import { authorize } from '../../security/auth'

let httpServer: http.Server | null = null

export async function startA2AHttpServer(_context: vscode.ExtensionContext) {
  try {
    const enabled = getSetting<boolean>('experimental.http.enabled') ?? false
    if (!enabled || httpServer) return
    const host = getSetting<string>('experimental.http.host') || '127.0.0.1'
    const port = getSetting<number>('experimental.http.port') || 50252
    const base = getSetting<string>('experimental.http.basePath') || '/a2a'

    httpServer = http.createServer((req, res) => {
      try {
        if (!req.url || !req.method) return res.writeHead(400).end('bad request')
        if (!req.url.startsWith(base)) return res.writeHead(404).end('not found')
        const chunks: Buffer[] = []
        req.on('data', (c) => chunks.push(Buffer.isBuffer(c) ? c : Buffer.from(c)))
        req.on('end', async () => {
          const body = chunks.length ? JSON.parse(Buffer.concat(chunks).toString('utf8')) : {}
          const send = (obj: any, code = 200) => { res.writeHead(code, { 'content-type': 'application/json' }); res.end(JSON.stringify(obj)) }

          if (req.method === 'GET' && req.url === `${base}/.well-known/agent-card`) {
            return send(buildAgentCard())
          }
          if (req.method === 'POST' && req.url === `${base}/invoke`) {
            const authz = await authorize((global as any).__extensionContext, 'http', String(body?.action || 'invoke'), req.headers['authorization'] as string || (req.headers['x-agent-key'] as string))
            if (!authz.ok) return send({ ok: false, error: authz.error || 'unauthorized' }, 401)
            const result = await handleA2ATrigger(body)
            return send(result)
          }
          if (req.method === 'POST' && req.url === `${base}/sendMessage`) {
            const authz = await authorize((global as any).__extensionContext, 'http', 'message', req.headers['authorization'] as string || (req.headers['x-agent-key'] as string))
            if (!authz.ok) return send({ ok: false, error: authz.error || 'unauthorized' }, 401)
            const { target, channel, text, metadata } = body || {}
            const result = await handleSendMessage({ agent: String(target?.agent || ''), channel, text, metadata })
            return send(result)
          }
          if (req.method === 'POST' && req.url === `${base}/tasks/create`) {
            const authz = await authorize((global as any).__extensionContext, 'http', 'task.create', req.headers['authorization'] as string || (req.headers['x-agent-key'] as string))
            if (!authz.ok) return send({ ok: false, error: authz.error || 'unauthorized' }, 401)
            const { target, title, params } = body || {}
            const result = await handleCreateTask({ agent: String(target?.agent || ''), title, params })
            return send(result)
          }
          if (req.method === 'POST' && req.url === `${base}/tasks/get`) {
            const authz = await authorize((global as any).__extensionContext, 'http', 'task.get', req.headers['authorization'] as string || (req.headers['x-agent-key'] as string))
            if (!authz.ok) return send({ ok: false, error: authz.error || 'unauthorized' }, 401)
            const { target, id } = body || {}
            const result = await handleGetTask({ agent: String(target?.agent || ''), id: String(id || '') })
            return send(result)
          }
          if (req.method === 'POST' && req.url === `${base}/tasks/list`) {
            const authz = await authorize((global as any).__extensionContext, 'http', 'task.list', req.headers['authorization'] as string || (req.headers['x-agent-key'] as string))
            if (!authz.ok) return send({ ok: false, error: authz.error || 'unauthorized' }, 401)
            const { target, filter, options } = body || {}
            const result = await handleListTasks({ agent: String(target?.agent || ''), filter, options })
            return send(result)
          }
          if (req.method === 'POST' && req.url === `${base}/tasks/cancel`) {
            const authz = await authorize((global as any).__extensionContext, 'http', 'task.cancel', req.headers['authorization'] as string || (req.headers['x-agent-key'] as string))
            if (!authz.ok) return send({ ok: false, error: authz.error || 'unauthorized' }, 401)
            const { target, id } = body || {}
            const result = await handleCancelTask({ agent: String(target?.agent || ''), id: String(id || '') })
            return send(result)
          }
          return send({ ok: false, error: 'not-found' }, 404)
        })
      } catch (e: any) {
        try { res.writeHead(500).end(JSON.stringify({ ok: false, error: String(e?.message || e) })) } catch {}
      }
      return undefined as unknown as void
    })
    httpServer.listen(port, host, () => console.log(`A2A HTTP listening on http://${host}:${port}${base}`))
  } catch (e) {
    console.warn('A2A HTTP server failed to start', e)
  }
}

export function stopA2AHttpServer() {
  try { httpServer?.close() } catch {}
  httpServer = null
}

export function buildAgentCard() {
  const httpEnabled = getSetting<boolean>('experimental.http.enabled') ?? false
  const httpHost = getSetting<string>('experimental.http.host') || '127.0.0.1'
  const httpPort = getSetting<number>('experimental.http.port') || 50252
  const httpBase = getSetting<string>('experimental.http.basePath') || '/a2a'
  const grpcEnabled = getSetting<boolean>('experimental.grpc.enabled') ?? false
  const grpcHost = getSetting<string>('experimental.grpc.host') || '127.0.0.1'
  const grpcPort = getSetting<number>('experimental.grpc.port') || 50251
  const mcpEnabled = getSetting<boolean>('experimental.mcp.enabled') ?? false
  const mcpHttpEnabled = getSetting<boolean>('experimental.mcp.http.enabled') ?? false
  const mcpHttpPort = getSetting<number>('experimental.mcp.http.port') ?? 4025
  const mcpHttpPath = getSetting<string>('experimental.mcp.http.path') ?? '/mcp'
  return {
    name: 'Agent Scheduler',
    version: '0.0.17',
    capabilities: ['a2a.invoke','message','task.create','task.get','task.list','task.cancel'],
    transports: {
      http: httpEnabled ? { base: `http://${httpHost}:${httpPort}${httpBase}` } : undefined,
      grpc: grpcEnabled ? { host: grpcHost, port: grpcPort, service: 'a2a.v1.A2AService' } : undefined,
      mcp: (mcpEnabled && mcpHttpEnabled) ? { url: `http://127.0.0.1:${mcpHttpPort}${mcpHttpPath}`, tools: ['a2a.invoke'] } : undefined,
    },
  }
}

import * as path from 'path'
import * as vscode from 'vscode'

import type * as grpcJs from '@grpc/grpc-js'
import type * as protoLoader from '@grpc/proto-loader'
import { handleA2ATrigger } from '../a2a'
import { getSetting } from '../../utils/config'

let server: any | null = null

export async function startA2AGrpcServer(context: vscode.ExtensionContext) {
  try {
    const enabled = getSetting<boolean>('experimental.grpc.enabled') ?? false
    if (!enabled || server) return

    // Lazy require to avoid bundling issues if not used
    const grpc: typeof grpcJs = require('@grpc/grpc-js')
    const loader: typeof protoLoader = require('@grpc/proto-loader')
    const host = getSetting<string>('experimental.grpc.host') || '127.0.0.1'
    const port = getSetting<number>('experimental.grpc.port') || 50251

    const protoPath = path.join(context.asAbsolutePath('dist'), 'protocols', 'grpc', 'a2a.proto')
    // Try also from src when running tests/out dir
    const altProtoPath = path.join(__dirname, '..', 'grpc', 'a2a.proto')

    const tryPaths = [protoPath, altProtoPath]
    let packageDef: any | undefined
    let loaded: any
    for (const p of tryPaths) {
      try {
        const def = await loader.load(p, { keepCase: true, longs: String, enums: String, defaults: true, oneofs: true })
        packageDef = def
        break
      } catch {}
    }
    if (!packageDef) {
      console.warn('A2A gRPC: failed to load .proto, server not started')
      return
    }
    loaded = grpc.loadPackageDefinition(packageDef)
    const svc = (loaded as any)['a2a']['v1']
    if (!svc || !svc.A2AService) {
      console.warn('A2A gRPC: invalid package loaded')
      return
    }

    server = new grpc.Server()
    server.addService(svc.A2AService.service, {
      Invoke: async (call: any, callback: any) => {
        try {
          const msg = call.request || {}
          const message = {
            protocol: 'a2a',
            version: String(msg.version || '1'),
            target: { agent: String(msg.targetAgent || '') },
            action: String(msg.action || ''),
            payload: msg.payload || {},
          }
          const result = await handleA2ATrigger(message)
          callback(null, { ok: !!result?.ok, error: result?.error || '', data: result?.data || {} })
        } catch (err: any) {
          callback(null, { ok: false, error: String(err?.message || 'exception') })
        }
      },
    })
    await new Promise<void>((resolve, reject) => {
      server!.bindAsync(`${host}:${port}`, grpc.ServerCredentials.createInsecure(), (err: any, _port: number) => {
        if (err) return reject(err)
        server!.start()
        resolve()
      })
    })
    context.subscriptions.push({ dispose: stopA2AGrpcServer })
  } catch (err) {
    console.warn('A2A gRPC server failed to start', err)
  }
}

export function stopA2AGrpcServer() {
  try {
    if (server) {
      server.forceShutdown()
      server = null
    }
  } catch {}
}


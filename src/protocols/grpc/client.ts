import type * as grpcJs from '@grpc/grpc-js'
import type * as protoLoader from '@grpc/proto-loader'
import * as path from 'path'
import * as vscode from 'vscode'
import { getSetting } from '../../utils/config'

let client: any | null = null

async function getClient(context: vscode.ExtensionContext): Promise<any | null> {
  try {
    const enabled = getSetting<boolean>('experimental.grpc.client.enabled') ?? false
    if (!enabled) return null
    if (client) return client
    const grpc: typeof grpcJs = require('@grpc/grpc-js')
    const loader: typeof protoLoader = require('@grpc/proto-loader')
    const target = getSetting<string>('experimental.grpc.client.target') || '127.0.0.1:50251'
    const protoPath = path.join(context.asAbsolutePath('dist'), 'protocols', 'grpc', 'a2a.proto')
    const altProtoPath = path.join(__dirname, '..', 'grpc', 'a2a.proto')
    const tryPaths = [protoPath, altProtoPath]
    let packageDef: any | undefined
    for (const p of tryPaths) {
      try {
        packageDef = await loader.load(p, { keepCase: true, longs: String, enums: String, defaults: true, oneofs: true })
        break
      } catch {}
    }
    if (!packageDef) return null
    const loaded = grpc.loadPackageDefinition(packageDef) as any
    const ServiceCtor = loaded?.a2a?.v1?.A2AService
    if (!ServiceCtor) return null
    client = new ServiceCtor(target, grpc.credentials.createInsecure())
    return client
  } catch {
    return null
  }
}

export async function invokeA2A(context: vscode.ExtensionContext, message: any): Promise<any> {
  const c = await getClient(context)
  if (!c) return { ok: false, error: 'grpc-client-disabled' }
  return new Promise((resolve) => {
    c.Invoke(
      {
        protocol: 'a2a',
        version: String(message?.version || '1'),
        targetAgent: String(message?.target?.agent || ''),
        action: String(message?.action || ''),
        payload: message?.payload || {},
      },
      (err: any, res: any) => {
        if (err) resolve({ ok: false, error: String(err?.message || 'grpc-error') })
        else resolve(res)
      },
    )
  })
}

export async function sendMessage(context: vscode.ExtensionContext, args: { target: { agent: string }, channel?: string, text: string, metadata?: any }): Promise<any> {
  const c = await getClient(context)
  if (!c) return { ok: false, error: 'grpc-client-disabled' }
  return new Promise((resolve) => {
    c.SendMessage({ targetAgent: args.target.agent, channel: args.channel || '', text: args.text, metadata: args.metadata || {} }, (err: any, res: any) => {
      if (err) resolve({ ok: false, error: String(err?.message || 'grpc-error') }); else resolve(res)
    })
  })
}

export async function createTask(context: vscode.ExtensionContext, args: { target: { agent: string }, title?: string, params?: any }): Promise<any> {
  const c = await getClient(context)
  if (!c) return { ok: false, error: 'grpc-client-disabled' }
  return new Promise((resolve) => {
    c.CreateTask({ targetAgent: args.target.agent, title: args.title || '', params: args.params || {} }, (err: any, res: any) => {
      if (err) resolve({ ok: false, error: String(err?.message || 'grpc-error') }); else resolve(res)
    })
  })
}

export async function getTask(context: vscode.ExtensionContext, args: { target: { agent: string }, id: string }): Promise<any> {
  const c = await getClient(context)
  if (!c) return { ok: false, error: 'grpc-client-disabled' }
  return new Promise((resolve) => {
    c.GetTask({ targetAgent: args.target.agent, id: args.id }, (err: any, res: any) => {
      if (err) resolve({ ok: false, error: String(err?.message || 'grpc-error') }); else resolve(res)
    })
  })
}

export async function listTasks(context: vscode.ExtensionContext, args: { target: { agent: string }, filter?: string, options?: any }): Promise<any> {
  const c = await getClient(context)
  if (!c) return { ok: false, error: 'grpc-client-disabled' }
  return new Promise((resolve) => {
    c.ListTasks({ targetAgent: args.target.agent, filter: args.filter || '', options: args.options || {} }, (err: any, res: any) => {
      if (err) resolve({ ok: false, error: String(err?.message || 'grpc-error') }); else resolve(res)
    })
  })
}

export async function cancelTask(context: vscode.ExtensionContext, args: { target: { agent: string }, id: string }): Promise<any> {
  const c = await getClient(context)
  if (!c) return { ok: false, error: 'grpc-client-disabled' }
  return new Promise((resolve) => {
    c.CancelTask({ targetAgent: args.target.agent, id: args.id }, (err: any, res: any) => {
      if (err) resolve({ ok: false, error: String(err?.message || 'grpc-error') }); else resolve(res)
    })
  })
}

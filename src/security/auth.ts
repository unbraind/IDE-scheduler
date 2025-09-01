import * as vscode from 'vscode'
import * as crypto from 'crypto'
import { getSetting } from '../utils/config'

export type Transport = 'http' | 'grpc' | 'mcp'
export type A2AAction = 'trigger' | 'list' | 'setActive' | 'message' | 'task.create' | 'task.get' | 'task.list' | 'task.cancel' | '*'

export interface KeyRecord {
  id: string
  label: string
  createdAt: string
  expiresAt?: string
  enabled: boolean
  scopes: { transports: Transport[]; actions: A2AAction[] }
  // secret (hashed token) is stored in SecretStorage under secretId
  secretId: string
  lastUsedAt?: string
}

const META_KEY = 'agentScheduler.auth.keys'
const SECRET_PREFIX = 'agentScheduler:auth:key:'

function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token, 'utf8').digest('hex')
}

export async function listKeys(context: vscode.ExtensionContext): Promise<KeyRecord[]> {
  const list = (context.globalState.get<KeyRecord[]>(META_KEY) ?? [])
  return list
}

export async function createKey(context: vscode.ExtensionContext, args: { label: string; transports?: Transport[]; actions?: A2AAction[]; expiresAt?: string }): Promise<{ record: KeyRecord; token: string }>{
  const id = crypto.randomUUID()
  const token = crypto.randomBytes(24).toString('base64url')
  const secretId = SECRET_PREFIX + id
  await context.secrets.store(secretId, hashToken(token))
  const record: KeyRecord = {
    id,
    label: args.label,
    createdAt: new Date().toISOString(),
    expiresAt: args.expiresAt,
    enabled: true,
    scopes: { transports: args.transports ?? ['http','grpc','mcp'], actions: args.actions ?? ['*'] },
    secretId,
  }
  const list = await listKeys(context)
  list.push(record)
  await context.globalState.update(META_KEY, list)
  return { record, token }
}

export async function revokeKey(context: vscode.ExtensionContext, id: string): Promise<boolean> {
  const list = await listKeys(context)
  const idx = list.findIndex(k => k.id === id)
  if (idx < 0) return false
  const rec = list[idx]
  try { await context.secrets.delete(rec.secretId) } catch {}
  list.splice(idx, 1)
  await context.globalState.update(META_KEY, list)
  return true
}

export async function setKeyEnabled(context: vscode.ExtensionContext, id: string, enabled: boolean): Promise<boolean> {
  const list = await listKeys(context)
  const rec = list.find(k => k.id === id)
  if (!rec) return false
  rec.enabled = enabled
  await context.globalState.update(META_KEY, list)
  return true
}

export async function updateKey(context: vscode.ExtensionContext, id: string, patch: Partial<Pick<KeyRecord, 'label'|'expiresAt'|'scopes'>>): Promise<boolean> {
  const list = await listKeys(context)
  const rec = list.find(k => k.id === id)
  if (!rec) return false
  if (typeof patch.label === 'string') rec.label = patch.label
  if (typeof patch.expiresAt === 'string' || patch.expiresAt === undefined) rec.expiresAt = patch.expiresAt
  if (patch.scopes) {
    if (Array.isArray(patch.scopes.transports)) rec.scopes.transports = patch.scopes.transports
    if (Array.isArray(patch.scopes.actions)) rec.scopes.actions = patch.scopes.actions
  }
  await context.globalState.update(META_KEY, list)
  return true
}

export async function authorize(context: vscode.ExtensionContext, transport: Transport, action: string, token?: string): Promise<{ ok: boolean; error?: string }> {
  const required = getSetting<boolean>(`experimental.auth.${transport}.required`) ?? false
  if (!required) return { ok: true }
  if (!token) return { ok: false, error: 'missing-token' }
  const presented = hashToken(token.replace(/^Bearer\s+/i, ''))
  const list = await listKeys(context)
  const now = Date.now()
  for (const rec of list) {
    if (!rec.enabled) continue
    if (rec.expiresAt && now > Date.parse(rec.expiresAt)) continue
    const stored = await context.secrets.get(rec.secretId)
    if (!stored || stored !== presented) continue
    if (rec.scopes.transports.length && !rec.scopes.transports.includes(transport)) continue
    if (rec.scopes.actions.length && !(rec.scopes.actions.includes('*' as A2AAction) || rec.scopes.actions.includes(action as A2AAction))) continue
    rec.lastUsedAt = new Date().toISOString()
    await context.globalState.update(META_KEY, list)
    return { ok: true }
  }
  return { ok: false, error: 'invalid-token' }
}

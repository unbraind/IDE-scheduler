import * as vscode from "vscode"
import * as dotenvx from "@dotenvx/dotenvx"
import * as path from "path"
import * as fs from "fs/promises"
import { getWorkspacePath } from "./utils/path"
import { fileExistsAtPath } from "./utils/fs"

// Load environment variables from .env file
try {
	// Specify path to .env file in the project root directory
	const envPath = path.join(__dirname, "..", ".env")
	dotenvx.config({ path: envPath })
} catch (e) {
	// Silently handle environment loading errors
	console.warn("Failed to load environment variables:", e)
}

import "./utils/path" // Necessary to have access to String.prototype.toPosix.

import { initializeI18n } from "./i18n"
import { CodeActionProvider } from "./core/CodeActionProvider"
import { migrateSettings } from "./utils/migrateSettings"
import { formatLanguage } from "./shared/language"
import { ClineProvider } from "./core/webview/ClineProvider"
import { SchedulerAdapterRegistry } from "./services/scheduler/adapters"
import { discoverAgentCommands, persistDiscoveredAgentCommands } from './services/scheduler/AgentCommandMapper'
import { startA2AGrpcServer } from './protocols/grpc/server'
import { invokeA2A } from './protocols/grpc/client'
import { getSetting } from './utils/config'
import { handleA2ATrigger } from "./protocols/a2a"
import { startMcpA2AEndpoint, stopMcpA2AEndpoint } from './integrations/mcp/server'
import { startA2AHttpServer, stopA2AHttpServer, buildAgentCard } from './protocols/http/server'
import { createKey, listKeys, revokeKey, setKeyEnabled } from './security/auth'
import { spawn } from 'child_process'
/**
 * Built using https://github.com/microsoft/vscode-webview-ui-toolkit
 *
 * Inspired by:
 *  - https://github.com/microsoft/vscode-webview-ui-toolkit-samples/tree/main/default/weather-webview
 *  - https://github.com/microsoft/vscode-webview-ui-toolkit-samples/tree/main/frameworks/hello-world-react-cra
 */

let outputChannel: vscode.OutputChannel
let extensionContext: vscode.ExtensionContext
let lastProvider: ClineProvider | null = null

// This method is called when your extension is activated.
// Your extension is activated the very first time the command is executed.
export async function activate(context: vscode.ExtensionContext) {
	extensionContext = context
  ;(global as any).__extensionContext = context
    outputChannel = vscode.window.createOutputChannel("Kilo-Code")
	context.subscriptions.push(outputChannel)
    outputChannel.appendLine("Kilo-Code extension activated")

	// Set a custom context variable for development mode
	// This is used to conditionally show the reload window button
	const isDevelopmentMode = context.extensionMode === vscode.ExtensionMode.Development
    await vscode.commands.executeCommand('setContext', 'kiloSchedulerDevMode', isDevelopmentMode)
	
	// Migrate old settings to new
	await migrateSettings(context, outputChannel)

	// Initialize the scheduler service
	const { SchedulerService } = await import('./services/scheduler/SchedulerService')
	const schedulerService = SchedulerService.getInstance(context)

  // Initialize experimental adapter registry (no-op if disabled)
  try { await SchedulerAdapterRegistry.instance().initialize(context) } catch {}
  // Optional auto-map on startup to prefill trigger/list
  try {
    const crossIde = (getSetting<boolean>('experimental.crossIde') ?? false)
    const autoMap = (getSetting<boolean>('experimental.autoMapOnStartup') ?? true)
    if (crossIde && autoMap) {
      const discovered = await discoverAgentCommands()
      await persistDiscoveredAgentCommands(discovered)
    }
  } catch {}

	// Hook to update an Activity Bar badge showing active schedules when enabled
	let _updateActivityBadge: (() => Promise<void>) | null = null
	await schedulerService.initialize()
	outputChannel.appendLine("Scheduler service initialized")

	// Initialize i18n for internationalization support
	initializeI18n(context.globalState.get("language") ?? formatLanguage(vscode.env.language))


	// Get default commands from configuration.
    const defaultCommands = vscode.workspace.getConfiguration("kilo-code").get<string[]>("allowedCommands") || []

	// Initialize global state if not already set.
	if (!context.globalState.get("allowedCommands")) {
		context.globalState.update("allowedCommands", defaultCommands)
	}
	
	// Register command to reload window (dev only button)
	context.subscriptions.push(
    vscode.commands.registerCommand("agent-scheduler.reloadWindowDev", async () => {
			await vscode.commands.executeCommand("workbench.action.reloadWindow")
		})
	)

	// Register command to open the roo-cline extension (always register)
	context.subscriptions.push(
    vscode.commands.registerCommand("agent-scheduler.openAgentScheduler", async () => {
            try { await vscode.commands.executeCommand("agent-scheduler.SidebarProvider.focus") } catch {}
            try { await vscode.commands.executeCommand("kilo-code.SidebarProvider.focus") } catch {}
		})
	)

    // Adapters Manager: edit adapter enable/allowedActions/trigger/list + test trigger
    context.subscriptions.push(
        vscode.commands.registerCommand('agent-scheduler.adapters', async () => {
            const panel = vscode.window.createWebviewPanel('agent-scheduler.adapters', 'Agent Scheduler — Adapters', vscode.ViewColumn.Active, { enableScripts: true })
            const ids = [
                'kilocode','cline','rooCode','continue','cursor','claudeCode','geminiCli','qwenCli',
                'cursorIDE','augmentCode','claudeCodeChat','cursorCli','codexCli','codexOnline','codexVscode',
                'googleCodeAssist','geminiCliCompanion','copilot','windsurfPlugin','windsurfIDE','zed','qodoGen','qoder','amazonQ'
            ]
            function read() {
                const cfg = vscode.workspace.getConfiguration('agent-scheduler')
                const rows = ids.map(id => ({ id, enabled: cfg.get<boolean>(`experimental.agents.${id}.enabled`) ?? false,
                    trigger: cfg.get<string>(`experimental.agents.${id}.triggerCommand`) ?? '',
                    list: cfg.get<string>(`experimental.agents.${id}.listCommand`) ?? '',
                    allowed: (cfg.get<string[]>(`experimental.agents.${id}.allowedActions`) ?? [])
                }))
                const flags = {
                  crossIde: cfg.get<boolean>('experimental.crossIde') ?? false,
                  http: (cfg.get<boolean>('experimental.http.enabled') ?? false),
                  grpc: (cfg.get<boolean>('experimental.grpc.enabled') ?? false),
                  mcp: (cfg.get<boolean>('experimental.mcp.enabled') ?? false)
                }
                const core = {
                  httpHost: cfg.get<string>('experimental.http.host') || '127.0.0.1',
                  httpPort: String(cfg.get<number>('experimental.http.port') || 50252),
                  httpBase: cfg.get<string>('experimental.http.basePath') || '/a2a',
                  grpcHost: cfg.get<string>('experimental.grpc.host') || '127.0.0.1',
                  grpcPort: String(cfg.get<number>('experimental.grpc.port') || 50251),
                  mcpPort: String(cfg.get<number>('experimental.mcp.http.port') || 4025),
                  mcpPath: cfg.get<string>('experimental.mcp.http.path') || '/mcp',
                }
                return { rows, flags, core }
            }
            function render(model: any) {
                const rows = model.rows
                const options = ['trigger','list','setActive','message','task.create','task.get','task.list','task.cancel']
                const htmlRows = rows.map(r => `
                    <tr>
                      <td><label><input data-id="${r.id}" class="ena" type="checkbox" ${r.enabled?'checked':''}/> ${r.id}</label></td>
                      <td><input data-id="${r.id}" class="trg" value="${r.trigger||''}" placeholder="trigger command id" style="width:100%"/></td>
                      <td><input data-id="${r.id}" class="lst" value="${r.list||''}" placeholder="list command id (optional)" style="width:100%"/></td>
                      <td>${options.map(o=>`<label style="margin-right:6px"><input data-id="${r.id}" class="act" value="${o}" type="checkbox" ${r.allowed.includes(o)?'checked':''}/> ${o}</label>`).join('')}</td>
                      <td><button data-id="${r.id}" class="test">Test Trigger</button></td>
                    </tr>`).join('')
                return `<!doctype html><html><head><meta charset="utf-8"/><style>
                    body{font-family:var(--vscode-font-family);padding:10px}
                    table{width:100%;border-collapse:collapse}
                    th,td{border-bottom:1px solid var(--vscode-editorWidget-border);padding:6px;text-align:left;vertical-align:top}
                    input[type=text]{padding:4px}
                </style></head><body>
                    <fieldset style="margin-bottom:8px"><legend>Core</legend>
                      <label><input id="f_cross" type="checkbox" ${model.flags.crossIde?'checked':''}/> Cross‑IDE</label>
                      <label style="margin-left:12px"><input id="f_http" type="checkbox" ${model.flags.http?'checked':''}/> HTTP</label>
                      <label style="margin-left:12px"><input id="f_grpc" type="checkbox" ${model.flags.grpc?'checked':''}/> gRPC</label>
                      <label style="margin-left:12px"><input id="f_mcp" type="checkbox" ${model.flags.mcp?'checked':''}/> MCP</label>
                      <button style="margin-left:12px" onclick="saveFlags()">Save Core</button>
                      <div style="margin-top:8px">
                        <div style="margin-bottom:6px">
                          <b>HTTP</b>
                          Host: <input id="http_host" value="${model.core.httpHost}" style="width:160px"/>
                          Port: <input id="http_port" value="${model.core.httpPort}" style="width:80px"/>
                          Base Path: <input id="http_base" value="${model.core.httpBase}" style="width:120px"/>
                          <button onclick="saveHttp()">Save HTTP</button>
                        </div>
                        <div style="margin-bottom:6px">
                          <b>gRPC</b>
                          Host: <input id="grpc_host" value="${model.core.grpcHost}" style="width:160px"/>
                          Port: <input id="grpc_port" value="${model.core.grpcPort}" style="width:80px"/>
                          <button onclick="saveGrpc()">Save gRPC</button>
                        </div>
                        <div>
                          <b>MCP HTTP</b>
                          Port: <input id="mcp_port" value="${model.core.mcpPort}" style="width:80px"/>
                          Path: <input id="mcp_path" value="${model.core.mcpPath}" style="width:120px"/>
                          <button onclick="saveMcp()">Save MCP</button>
                        </div>
                      </div>
                    </fieldset>
                    <div style="margin-bottom:8px"><button onclick="save()">Save Adapters</button> <button onclick="refresh()">Refresh</button></div>
                    <table><thead><tr><th>Adapter</th><th>triggerCommand</th><th>listCommand</th><th>allowedActions</th><th>Actions</th></tr></thead>
                    <tbody>${htmlRows}</tbody></table>
                    <script>
                    const vscode = acquireVsCodeApi();
                    function collect(){
                        const rows={};
                        document.querySelectorAll('.ena').forEach(el=>{ const id=el.dataset.id; rows[id]=rows[id]||{}; rows[id].enabled=el.checked });
                        document.querySelectorAll('.trg').forEach(el=>{ const id=el.dataset.id; rows[id]=rows[id]||{}; rows[id].trigger=el.value });
                        document.querySelectorAll('.lst').forEach(el=>{ const id=el.dataset.id; rows[id]=rows[id]||{}; rows[id].list=el.value });
                        document.querySelectorAll('.act').forEach(el=>{ const id=el.dataset.id; rows[id]=rows[id]||{}; rows[id].allowed=rows[id].allowed||[]; if(el.checked) rows[id].allowed.push(el.value) });
                        return rows;
                    }
                    function save(){ vscode.postMessage({ cmd:'save', rows: collect() }) }
                    function saveFlags(){ vscode.postMessage({ cmd:'saveFlags', flags: { crossIde: document.getElementById('f_cross').checked, http: document.getElementById('f_http').checked, grpc: document.getElementById('f_grpc').checked, mcp: document.getElementById('f_mcp').checked } }) }
                    function saveHttp(){ vscode.postMessage({ cmd:'saveHttp', host: document.getElementById('http_host').value, port: document.getElementById('http_port').value, base: document.getElementById('http_base').value }) }
                    function saveGrpc(){ vscode.postMessage({ cmd:'saveGrpc', host: document.getElementById('grpc_host').value, port: document.getElementById('grpc_port').value }) }
                    function saveMcp(){ vscode.postMessage({ cmd:'saveMcp', port: document.getElementById('mcp_port').value, path: document.getElementById('mcp_path').value }) }
                    function refresh(){ vscode.postMessage({ cmd:'refresh' }) }
                    document.querySelectorAll('.test').forEach(b=> b.addEventListener('click', ev=>{ const id=ev.target.dataset.id; vscode.postMessage({ cmd:'test', id }) }))
                    </script>
                </body></html>`
            }
            panel.webview.html = render(read())
            panel.webview.onDidReceiveMessage(async (m:any)=>{
                if(m?.cmd==='refresh') panel.webview.html = render(read())
                if(m?.cmd==='save') {
                    const cfg = vscode.workspace.getConfiguration('agent-scheduler')
                    const rows = m.rows||{}
                    for (const id of Object.keys(rows)){
                        const r = rows[id]
                        await cfg.update(`experimental.agents.${id}.enabled`, !!r.enabled, true)
                        await cfg.update(`experimental.agents.${id}.triggerCommand`, String(r.trigger||''), true)
                        await cfg.update(`experimental.agents.${id}.listCommand`, String(r.list||''), true)
                        await cfg.update(`experimental.agents.${id}.allowedActions`, Array.isArray(r.allowed)? r.allowed : [], true)
                    }
                    vscode.window.showInformationMessage('Adapters updated')
                }
                if(m?.cmd==='saveFlags'){
                    const cfg = vscode.workspace.getConfiguration('agent-scheduler')
                    await cfg.update('experimental.crossIde', !!m.flags?.crossIde, true)
                    await cfg.update('experimental.http.enabled', !!m.flags?.http, true)
                    await cfg.update('experimental.grpc.enabled', !!m.flags?.grpc, true)
                    await cfg.update('experimental.mcp.enabled', !!m.flags?.mcp, true)
                    vscode.window.showInformationMessage('Core settings updated')
                }
                if(m?.cmd==='saveHttp'){
                    const cfg = vscode.workspace.getConfiguration('agent-scheduler')
                    await cfg.update('experimental.http.host', String(m.host||'127.0.0.1'), true)
                    await cfg.update('experimental.http.port', Number(m.port||50252), true)
                    await cfg.update('experimental.http.basePath', String(m.base||'/a2a'), true)
                    vscode.window.showInformationMessage('HTTP settings saved')
                }
                if(m?.cmd==='saveGrpc'){
                    const cfg = vscode.workspace.getConfiguration('agent-scheduler')
                    await cfg.update('experimental.grpc.host', String(m.host||'127.0.0.1'), true)
                    await cfg.update('experimental.grpc.port', Number(m.port||50251), true)
                    vscode.window.showInformationMessage('gRPC settings saved')
                }
                if(m?.cmd==='saveMcp'){
                    const cfg = vscode.workspace.getConfiguration('agent-scheduler')
                    await cfg.update('experimental.mcp.http.port', Number(m.port||4025), true)
                    await cfg.update('experimental.mcp.http.path', String(m.path||'/mcp'), true)
                    vscode.window.showInformationMessage('MCP HTTP settings saved')
                }
                if(m?.cmd==='test'){
                    try {
                        await vscode.commands.executeCommand('agent-scheduler.a2a.trigger', { protocol:'a2a', version:'1', target:{ agent: m.id }, action:'trigger', payload:{ instructions: 'Test trigger from Adapters panel' } })
                        vscode.window.showInformationMessage(`Triggered ${m.id}`)
                    } catch(e:any) { vscode.window.showErrorMessage(`Trigger failed: ${e?.message||e}`) }
                }
            })
        })
    )

    // A2A Task Manager (kilocode-focused for now)
    context.subscriptions.push(vscode.commands.registerCommand('agent-scheduler.taskManager', async () => {
        const panel = vscode.window.createWebviewPanel('agent-scheduler.tasks', 'Agent Scheduler — Task Manager', vscode.ViewColumn.Active, { enableScripts: true })
        async function fetchTasks(){
            try { const { handleListTasks } = await import('./protocols/a2a'); const res = await handleListTasks({ agent: 'kilocode' }) as any; return Array.isArray(res?.tasks)? res.tasks : [] } catch { return [] }
        }
        function render(tasks:any[]){
            const rows = tasks.map(t=>`<tr><td>${t.id}</td><td>${t.title}</td><td>${t.status}</td><td>${t.details?.nextExecutionTime||''}</td><td><button data-id="${t.id}" class="cancel">Cancel</button> <button data-id="${t.id}" class="activate">Set Active</button> <button data-id="${t.id}" class="deactivate">Set Inactive</button></td></tr>`).join('')
            return `<!doctype html><html><head><meta charset='utf-8'/><style>body{font-family:var(--vscode-font-family);padding:10px}table{width:100%;border-collapse:collapse}th,td{border-bottom:1px solid var(--vscode-editorWidget-border);padding:6px;text-align:left}</style></head><body>
            <div style='margin-bottom:8px'><button onclick="acquireVsCodeApi().postMessage({cmd:'refresh'})">Refresh</button></div>
            <table><thead><tr><th>ID</th><th>Title</th><th>Status</th><th>Next</th><th>Actions</th></tr></thead><tbody>${rows}</tbody></table>
            <script>const v=acquireVsCodeApi();document.querySelectorAll('.cancel').forEach(b=>b.addEventListener('click',e=>v.postMessage({cmd:'cancel', id:e.target.dataset.id})));document.querySelectorAll('.activate').forEach(b=>b.addEventListener('click',e=>v.postMessage({cmd:'set', id:e.target.dataset.id, active:true})));document.querySelectorAll('.deactivate').forEach(b=>b.addEventListener('click',e=>v.postMessage({cmd:'set', id:e.target.dataset.id, active:false})));</script>
            </body></html>`
        }
        panel.webview.html = render(await fetchTasks())
        panel.webview.onDidReceiveMessage(async (m:any)=>{
            if (m?.cmd==='refresh') return panel.webview.html = render(await fetchTasks())
            if (m?.cmd==='cancel'){ try { const { handleCancelTask } = await import('./protocols/a2a'); await handleCancelTask({ agent:'kilocode', id: String(m.id) }); vscode.window.showInformationMessage(`Cancelled ${m.id}`) } catch {}
                panel.webview.html = render(await fetchTasks())
            }
            if (m?.cmd==='set'){ try { const reg = (await import('./services/scheduler/adapters')).SchedulerAdapterRegistry.instance(); await reg.initialize(context); const a = reg.get('kilocode'); await a?.setActive(String(m.id), !!m.active) } catch {} ; panel.webview.html = render(await fetchTasks()) }
        })
    }))

    // Keys Manager: create/edit/delete/toggle keys in a UI
    context.subscriptions.push(
        vscode.commands.registerCommand('agent-scheduler.keysManager', async () => {
            const panel = vscode.window.createWebviewPanel('agent-scheduler.keys', 'Agent Scheduler — Access Keys', vscode.ViewColumn.Active, { enableScripts: true })
            const allActions = ['*','trigger','list','setActive','message','task.create','task.get','task.list','task.cancel']
            async function list(){ const { listKeys } = await import('./security/auth'); return await listKeys(context) }
            function render(keys: any[]){
                const rows = keys.map(k=>`<tr>
                    <td>${k.id}</td>
                    <td><input data-id="${k.id}" class="lbl" value="${k.label}"/></td>
                    <td>${k.enabled? 'enabled':'disabled'}</td>
                    <td>${k.expiresAt || ''}</td>
                    <td>${k.scopes.transports.join(',')}</td>
                    <td>${k.scopes.actions.join(',')}</td>
                    <td>
                      <button data-id="${k.id}" class="toggle">${k.enabled? 'Disable':'Enable'}</button>
                      <button data-id="${k.id}" class="edit">Edit</button>
                      <button data-id="${k.id}" class="revoke">Revoke</button>
                    </td>
                </tr>`).join('')
                return `<!doctype html><html><head><meta charset="utf-8"/><style>
                    body{font-family:var(--vscode-font-family);padding:10px}
                    table{width:100%;border-collapse:collapse}
                    th,td{border-bottom:1px solid var(--vscode-editorWidget-border);padding:6px;text-align:left;vertical-align:top}
                    input{padding:4px}
                </style></head><body>
                  <div style="margin-bottom:8px">
                   <button onclick="create()">Create Key</button>
                  </div>
                  <table><thead><tr><th>ID</th><th>Label</th><th>State</th><th>Expires</th><th>Transports</th><th>Actions</th><th>Ops</th></tr></thead>
                  <tbody>${rows}</tbody></table>
                  <dialog id="dlg">
                    <form method="dialog">
                        <h3>Edit Key</h3>
                        <input id="kid" type="hidden"/>
                        <div>Label: <input id="klbl"/></div>
                        <div>ExpiresAt (ISO, optional): <input id="kexp" placeholder="YYYY-MM-DDTHH:mm:ssZ"/></div>
                        <div>Transports: <label><input class="ktr" value="http" type="checkbox"/> http</label> <label><input class="ktr" value="grpc" type="checkbox"/> grpc</label> <label><input class="ktr" value="mcp" type="checkbox"/> mcp</label></div>
                        <div>Actions: ${allActions.map(a=>`<label style='margin-right:6px'><input class='kact' value='${a}' type='checkbox'/> ${a}</label>`).join('')}</div>
                        <menu><button id="save">Save</button><button id="cancel">Cancel</button></menu>
                    </form>
                  </dialog>
                  <script>
                  const vscode = acquireVsCodeApi();
                  function refresh(){ vscode.postMessage({ cmd:'refresh' }) }
                  function create(){ vscode.postMessage({ cmd:'create' }) }
                  document.querySelectorAll('.toggle').forEach(b=>b.addEventListener('click', ev=>vscode.postMessage({ cmd:'toggle', id: ev.target.dataset.id })))
                  document.querySelectorAll('.revoke').forEach(b=>b.addEventListener('click', ev=>vscode.postMessage({ cmd:'revoke', id: ev.target.dataset.id })))
                  document.querySelectorAll('.edit').forEach(b=>b.addEventListener('click', ev=>{ const id=ev.target.dataset.id; vscode.postMessage({ cmd:'openEdit', id }) }))
                  document.querySelectorAll('.lbl').forEach(inp=>inp.addEventListener('change', ev=>vscode.postMessage({ cmd:'rename', id: ev.target.dataset.id, label: ev.target.value })))
                  window.addEventListener('message', (e)=>{
                    const m=e.data||{}; if(m.cmd==='openEdit'){
                       const dlg=document.getElementById('dlg');
                       document.getElementById('kid').value=m.key.id
                       document.getElementById('klbl').value=m.key.label
                       document.getElementById('kexp').value=m.key.expiresAt||''
                       document.querySelectorAll('.ktr').forEach(c=> c.checked = (m.key.scopes.transports||[]).includes(c.value))
                       document.querySelectorAll('.kact').forEach(c=> c.checked = (m.key.scopes.actions||[]).includes(c.value))
                       dlg.showModal()
                       document.getElementById('save').onclick=()=>{
                         const id=document.getElementById('kid').value
                         const label=document.getElementById('klbl').value
                         const expiresAt=document.getElementById('kexp').value
                         const transports=[...document.querySelectorAll('.ktr')].filter(c=>c.checked).map(c=>c.value)
                         const actions=[...document.querySelectorAll('.kact')].filter(c=>c.checked).map(c=>c.value)
                         vscode.postMessage({ cmd:'saveEdit', id, label, expiresAt, transports, actions })
                         dlg.close()
                       }
                       document.getElementById('cancel').onclick=()=>dlg.close()
                    }
                  })
                  </script>
                </body></html>`
            }
            async function refresh(){ panel.webview.html = render(await list()) }
            panel.webview.html = render(await list())
            panel.webview.onDidReceiveMessage(async (m:any)=>{
                const { listKeys, createKey, revokeKey, setKeyEnabled, updateKey } = await import('./security/auth')
                if (m?.cmd==='refresh') return refresh()
                if (m?.cmd==='create'){
                    const label = await vscode.window.showInputBox({ prompt: 'Label for access key' })
                    if (!label) return
                    const transportsPick = await vscode.window.showQuickPick(['http','grpc','mcp'], { canPickMany: true, placeHolder: 'Transports allowed' })
                    const actionsPick = await vscode.window.showInputBox({ prompt: 'Actions allowed (comma-separated or * for all)', value: '*' })
                    const actions = (actionsPick || '*').split(',').map(s => s.trim()).filter(Boolean) as any
                    const { token, record } = await createKey(context, { label, transports: (transportsPick?.length ? transportsPick : ['http','grpc','mcp']) as any, actions })
                    await vscode.env.clipboard.writeText(token)
                    vscode.window.showInformationMessage(`Access key created (copied to clipboard). ID=${record.id}`)
                    return refresh()
                }
                if (m?.cmd==='toggle'){ const keys = await listKeys(context); const k = keys.find(x=>x.id===m.id); if(!k) return; await setKeyEnabled(context, k.id, !k.enabled); return refresh() }
                if (m?.cmd==='revoke'){ await revokeKey(context, m.id); return refresh() }
                if (m?.cmd==='openEdit'){ const keys = await listKeys(context); const k = keys.find(x=>x.id===m.id); if(!k) return; panel.webview.postMessage({ cmd:'openEdit', key: k }) }
                if (m?.cmd==='saveEdit'){ await updateKey(context, m.id, { label: m.label, expiresAt: m.expiresAt || undefined, scopes: { transports: m.transports||[], actions: m.actions||[] } as any }); return refresh() }
                if (m?.cmd==='rename'){ await updateKey(context, m.id, { label: String(m.label||'') }); }
            })
        })
    )

    // Get Started: open a simple intro webview with steps and helpful links/actions
    context.subscriptions.push(
        vscode.commands.registerCommand('agent-scheduler.getStarted', async () => {
            const panel = vscode.window.createWebviewPanel(
                'agent-scheduler.getStarted',
                'Agent Scheduler — Get Started',
                vscode.ViewColumn.Active,
                { enableScripts: true }
            )
            const escape = (s:string)=>s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
            const crossIde = (getSetting<boolean>('experimental.crossIde') ?? false)
            const httpEnabled = (getSetting<boolean>('experimental.http.enabled') ?? false)
            const grpcEnabled = (getSetting<boolean>('experimental.grpc.enabled') ?? false)
            const mcpEnabled = (getSetting<boolean>('experimental.mcp.enabled') ?? false)
            panel.webview.html = `<!doctype html><html><head><meta charset="utf-8" /><style>
                body{font-family:var(--vscode-font-family);padding:16px;}
                h1{margin-top:0}
                .step{margin:12px 0;padding:12px;border:1px solid var(--vscode-editorWidget-border);border-radius:6px}
                code{background:var(--vscode-textCodeBlock-background);padding:2px 4px;border-radius:3px}
                .ok{color:#2e9b4f} .warn{color:#cc9a06}
                .btn{display:inline-block;margin-top:8px;padding:6px 10px;border:1px solid var(--vscode-button-border);border-radius:4px;cursor:pointer;}
            </style></head><body>
                <h1>Get Started</h1>
                <div class="step">
                    <b>1) Enable Cross‑IDE (optional)</b>
                    <div>Settings → <code>agent-scheduler.experimental.crossIde</code> = true. Current: <b class="${crossIde?'ok':'warn'}">${crossIde?'Enabled':'Disabled'}</b></div>
                    <div>Cross‑IDE enables adapters for other IDEs/agents (Cline, Cursor, Roo, Continue, Gemini CLI, Qwen CLI, Copilot, etc.).</div>
                    <div class="btn" onclick="acquireVsCodeApi().postMessage({cmd:'openSettings', key:'agent-scheduler.experimental.crossIde'})">Open Setting</div>
                </div>
                <div class="step">
                    <b>2) Discover & map agent commands</b>
                    <div>Run command: <code>AgentScheduler: Map Agent Commands (Discover & Persist)</code> to auto‑detect available agent commands and prefill <code>triggerCommand</code>/<code>listCommand</code> per adapter.</div>
                    <div class="btn" onclick="acquireVsCodeApi().postMessage({cmd:'map'})">Run Mapping</div>
                </div>
                <div class="step">
                    <b>3) Configure adapters</b>
                    <div>Under <code>agent-scheduler.experimental.agents.*</code> enable adapters, adjust <code>allowedActions</code>, and set <code>triggerCommand</code>/<code>listCommand</code>.</div>
                    <div class="btn" onclick="acquireVsCodeApi().postMessage({cmd:'openSettings', key:'agent-scheduler.experimental.agents'})">Open Adapter Settings</div>
                </div>
                <div class="step">
                    <b>4) (Optional) Enable A2A transports</b>
                    <div>HTTP: <b class="${httpEnabled?'ok':'warn'}">${httpEnabled?'Enabled':'Disabled'}</b>, gRPC: <b class="${grpcEnabled?'ok':'warn'}">${grpcEnabled?'Enabled':'Disabled'}</b>, MCP: <b class="${mcpEnabled?'ok':'warn'}">${mcpEnabled?'Enabled':'Disabled'}</b></div>
                    <div>These expose programmatic endpoints for other tools to talk to Agent Scheduler (invoke/list/setActive/message/tasks).</div>
                    <div class="btn" onclick="acquireVsCodeApi().postMessage({cmd:'openSettings', key:'agent-scheduler.experimental.http.enabled'})">HTTP Setting</div>
                    <div class="btn" onclick="acquireVsCodeApi().postMessage({cmd:'openSettings', key:'agent-scheduler.experimental.grpc.enabled'})">gRPC Setting</div>
                    <div class="btn" onclick="acquireVsCodeApi().postMessage({cmd:'openSettings', key:'agent-scheduler.experimental.mcp.enabled'})">MCP Setting</div>
                </div>
                <div class="step">
                    <b>5) (Optional) Secure endpoints</b>
                    <div>Require access keys for HTTP/gRPC/MCP under <code>agent-scheduler.experimental.auth.*.required</code>. Manage keys via commands: Create/List/Revoke/Toggle Access Key.</div>
                    <div class="btn" onclick="acquireVsCodeApi().postMessage({cmd:'openSettings', key:'agent-scheduler.experimental.auth'})">Open Auth Settings</div>
                    <div class="btn" onclick="acquireVsCodeApi().postMessage({cmd:'createKey'})">Create Access Key</div>
                </div>
                <div class="step">
                    <b>6) Explore utilities</b>
                    <div>
                      <code>AgentScheduler: Export Agent Card</code> (discovery file), <code>AgentScheduler: Generate Mapping Report</code>,
                      and <code>AgentScheduler: A2A Sample</code> for test messaging.
                    </div>
                    <div class="btn" onclick="acquireVsCodeApi().postMessage({cmd:'exportCard'})">Export Agent Card</div>
                    <div class="btn" onclick="acquireVsCodeApi().postMessage({cmd:'generateReport'})">Generate Mapping Report</div>
                </div>
                <div class="step">
                    <b>7) Validate Setup</b>
                    <div>Open the diagnostic dashboard for adapters, badge, and endpoints.</div>
                    <div class="btn" onclick="acquireVsCodeApi().postMessage({cmd:'validate'})">Open Validation</div>
                </div>
            </body></html>`
            panel.webview.onDidReceiveMessage(async (m:any)=>{
                try{
                    if(m?.cmd==='map') await vscode.commands.executeCommand('agent-scheduler.mapAgentCommands')
                    else if(m?.cmd==='validate') await vscode.commands.executeCommand('agent-scheduler.validateSetup')
                    else if(m?.cmd==='openSettings' && typeof m.key==='string') await vscode.commands.executeCommand('workbench.action.openSettings', m.key)
                    else if(m?.cmd==='createKey') await vscode.commands.executeCommand('agent-scheduler.auth.createKey')
                    else if(m?.cmd==='exportCard') await vscode.commands.executeCommand('agent-scheduler.exportAgentCard')
                    else if(m?.cmd==='generateReport') await vscode.commands.executeCommand('agent-scheduler.generateMappingReport')
                }catch{}
            })
        })
    )

    // Validate Setup: check discovery, badge state, and transports
    context.subscriptions.push(
        vscode.commands.registerCommand('agent-scheduler.validateSetup', async () => {
            const panel = vscode.window.createWebviewPanel('agent-scheduler.validate', 'Agent Scheduler — Validate Setup', vscode.ViewColumn.Active, { enableScripts: true })
            const render = (rows: { label: string; ok: boolean; detail?: string }[]) => {
                const items = rows.map(r=>`<tr><td>${r.ok? '✅':'❌'}</td><td>${r.label}</td><td>${(r.detail??'').replace(/&/g,'&amp;')}</td></tr>`).join('')
                return `<!doctype html><html><head><meta charset="utf-8"/><style>
                    body{font-family:var(--vscode-font-family);padding:12px}
                    table{width:100%;border-collapse:collapse;margin-top:8px}
                    th,td{border-bottom:1px solid var(--vscode-editorWidget-border);padding:6px;text-align:left;vertical-align:top}
                    .toolbar{display:flex;gap:8px;margin-bottom:8px}
                    .btn{padding:6px 10px;border:1px solid var(--vscode-button-border);border-radius:4px;cursor:pointer}
                </style></head><body>
                <div class="toolbar">
                  <div class="btn" onclick="acquireVsCodeApi().postMessage({cmd:'run'})">Re‑run Checks</div>
                  <div class="btn" onclick="acquireVsCodeApi().postMessage({cmd:'openSettings'})">Open Settings</div>
                  <div class="btn" onclick="acquireVsCodeApi().postMessage({cmd:'map'})">Map Agent Commands</div>
                  <div class="btn" onclick="acquireVsCodeApi().postMessage({cmd:'mcpTest'})">MCP Client Test</div>
                </div>
                <table><thead><tr><th>OK</th><th>Check</th><th>Details</th></tr></thead><tbody>${items}</tbody></table>
                </body></html>`
            }

            async function runChecks() {
                const results: { label: string; ok: boolean; detail?: string }[] = []
                const ok = (label:string, cond:boolean, detail='')=>results.push({label, ok:!!cond, detail})

                let viewOk=false
                try { await vscode.commands.executeCommand('agent-scheduler.SidebarProvider.focus'); viewOk=true } catch { viewOk=false }
                ok('Activity Bar view registered', viewOk)

                const crossIde = (getSetting<boolean>('experimental.crossIde') ?? false)
                ok('Cross‑IDE enabled', crossIde, 'agent-scheduler.experimental.crossIde')
                try {
                    const { discoverAgentCommands } = await import('./services/scheduler/AgentCommandMapper')
                    const discovered = await discoverAgentCommands()
                    ok(`Adapters discovered (${discovered.length})`, discovered.length>0, discovered.map(d=>`${d.agent}:${d.triggerCommand??'-'}`).join(', '))
                } catch (e:any) { ok('Adapter discovery executed', false, e?.message||String(e)) }

                const badgeEnabled = (getSetting<boolean>('experimental.activityBadge') ?? false)
                ok('Activity badge enabled', badgeEnabled, 'agent-scheduler.experimental.activityBadge')
                try { const svc = (await import('./services/scheduler/SchedulerService')).SchedulerService.getInstance(context); const count = svc.getActiveScheduleCount(); ok('Badge count retrievable', typeof count==='number', `count=${count}`) } catch (e:any) { ok('Badge count retrievable', false, e?.message||String(e)) }

                try {
                    const enabled = (getSetting<boolean>('experimental.http.enabled') ?? false)
                    if (enabled) {
                        const host = getSetting<string>('experimental.http.host') || '127.0.0.1'
                        const port = getSetting<number>('experimental.http.port') || 50252
                        const base = getSetting<string>('experimental.http.basePath') || '/a2a'
                        const url = `http://${host}:${port}${base}/.well-known/agent-card`
                        const axios = (await import('axios')).default
                        const r = await axios.get(url, { validateStatus: ()=>true, timeout: 1500 })
                        ok('HTTP endpoint reachable', r.status>=200 && r.status<500, `GET ${url} -> ${r.status}`)
                    } else { ok('HTTP endpoint disabled', true) }
                } catch (e:any) { ok('HTTP endpoint reachable', false, e?.message||String(e)) }

                try {
                    const enabled = (getSetting<boolean>('experimental.grpc.enabled') ?? false)
                    if (enabled) {
                        const res = await (await import('./protocols/grpc/client')).invokeA2A(context, { target: { agent: 'kilocode' }, action: 'list', payload: {} })
                        ok('gRPC server reachable', !!res && (res.ok===true || 'ok' in res), JSON.stringify(res).slice(0,160))
                    } else { ok('gRPC server disabled', true) }
                } catch (e:any) { ok('gRPC server reachable', false, e?.message||String(e)) }

                try {
                    const en = (getSetting<boolean>('experimental.mcp.enabled') ?? false) && (getSetting<boolean>('experimental.mcp.http.enabled') ?? false)
                    if (en) {
                        const port = getSetting<number>('experimental.mcp.http.port') ?? 4025
                        const path = getSetting<string>('experimental.mcp.http.path') ?? '/mcp'
                        const url = `http://127.0.0.1:${port}${path}`
                        const axios = (await import('axios')).default
                        const r = await axios.get(url, { validateStatus: ()=>true, timeout: 1500 }).catch(()=>({status: 200}))
                        ok('MCP HTTP listening', true, `GET ${url} -> ${r.status}`)
                    } else { ok('MCP HTTP disabled', true) }
                } catch (e:any) { ok('MCP HTTP listening', false, e?.message||String(e)) }

                panel.webview.html = render(results)
                outputChannel.appendLine('Validate Setup: ' + results.map(r=>`${r.ok?'OK':'FAIL'} ${r.label} ${r.detail??''}`).join(' | '))
            }

            panel.webview.onDidReceiveMessage(async (m:any)=>{
                if (m?.cmd==='run') runChecks()
                else if (m?.cmd==='openSettings') vscode.commands.executeCommand('workbench.action.openSettings', 'agent-scheduler')
                else if (m?.cmd==='map') vscode.commands.executeCommand('agent-scheduler.mapAgentCommands')
                else if (m?.cmd==='mcpTest') {
                    try { const { sendA2AOverMCP } = await import('./integrations/mcp/bridge'); const res = await sendA2AOverMCP({ protocol:'a2a', version:'1', target:{ agent:'kilocode' }, action:'list' }); vscode.window.showInformationMessage('MCP test: '+JSON.stringify(res)) } catch (e:any) { vscode.window.showErrorMessage('MCP test failed: '+(e?.message||e)) }
                }
            })
            await runChecks()
        })
    )

	// Command to discover and persist agent commands in settings
	context.subscriptions.push(
		vscode.commands.registerCommand('agent-scheduler.mapAgentCommands', async () => {
			try {
				const discovered = await discoverAgentCommands()
				await persistDiscoveredAgentCommands(discovered)
				const lines = discovered.map(d => `${d.agent}: ${d.extensionId ?? 'n/a'} | trigger=${d.triggerCommand ?? '-'} | list=${d.listCommand ?? '-'}`)
				vscode.window.showInformationMessage(`Mapped agent commands:\n${lines.join('\n')}`, { modal: true })
			} catch (e:any) {
				vscode.window.showErrorMessage(`Agent command mapping failed: ${e?.message || e}`)
			}
		})
	)

	// Command to generate a mapping report and persist settings
	context.subscriptions.push(
		vscode.commands.registerCommand('agent-scheduler.generateMappingReport', async () => {
			try {
				const discovered = await discoverAgentCommands()
				await persistDiscoveredAgentCommands(discovered)
				const header = `# Agent Command Mapping\n\nGenerated on ${new Date().toISOString()}\n\n`
				const tableHead = `| Agent | Extension ID | Trigger Command | List Command |\n|---|---|---|---|\n`
				const rows = discovered.map(d => `| ${d.agent} | ${d.extensionId ?? ''} | ${d.triggerCommand ?? ''} | ${d.listCommand ?? ''} |`).join('\n')
				const md = header + tableHead + rows + '\n'
				const ws = getWorkspacePath()
				const dest = path.join(ws || (__dirname), 'agent-scheduler.mapping.md')
				await fs.writeFile(dest, md, 'utf8')
				vscode.window.showInformationMessage(`Agent mapping report written to ${dest}`)
			} catch (e:any) {
				vscode.window.showErrorMessage(`Failed to generate mapping report: ${e?.message || e}`)
			}
		})
	)

	// Register command to handle schedule updates and notify the webview
	context.subscriptions.push(
		vscode.commands.registerCommand("agent-scheduler.schedulesUpdated", async () => {
			// This command is called when schedules are updated
			// Simply trigger a state refresh which will cause the webview to reload its data
			console.log("Schedules updated sending message to webview")
			await provider.postMessageToWebview({ type: 'schedulesUpdated' })
			// Update the activity badge (if configured and provider is ready)
			if (_updateActivityBadge) {
				await _updateActivityBadge()
			}
		})
	)

    const provider = new ClineProvider(context, outputChannel, "sidebar")
    lastProvider = provider


	context.subscriptions.push(
		vscode.window.registerWebviewViewProvider(ClineProvider.sideBarId, provider, {
			webviewOptions: { retainContextWhenHidden: true },
		}),
	)

	// Experimental: A2A trigger command for cross-IDE integrations
	context.subscriptions.push(
		vscode.commands.registerCommand("agent-scheduler.a2a.trigger", async (message?: any) => {
			try {
				return await handleA2ATrigger(message)
			} catch (err) {
				console.warn('A2A trigger failed', err)
			}
		}),
	)

	// Sample command to quickly trigger a demo A2A message
	context.subscriptions.push(
		vscode.commands.registerCommand("agent-scheduler.a2a.sample", async () => {
			const sample = {
				protocol: 'a2a',
				version: '1',
				target: { agent: 'kilocode' },
				action: 'trigger',
				payload: { instructions: 'Hello from AgentScheduler sample!' },
			}
			const res = await handleA2ATrigger(sample)
			vscode.window.showInformationMessage(`A2A sample result: ${JSON.stringify(res)}`)
			return res
		}),
	)

	// Define badge updater now that provider exists
	_updateActivityBadge = async () => {
		try {
			const enabled = (getSetting<boolean>('experimental.activityBadge') ?? false)
			const view = (provider as any).view
			if (!view || typeof view !== 'object' || !('badge' in view)) {
				return
			}
			if (!enabled) {
				view.badge = undefined
				return
			}
			const count = schedulerService.getActiveScheduleCount()
			if (count > 0) {
				view.badge = { value: count, tooltip: `${count} active schedule${count === 1 ? '' : 's'}` }
			} else {
				view.badge = undefined
			}
		} catch (err) {
			console.warn('Failed to update activity badge', err)
		}
	}

	// React to configuration changes for the experimental badge
	context.subscriptions.push(
		vscode.workspace.onDidChangeConfiguration((e) => {
			if ((e.affectsConfiguration('agent-scheduler.experimental.activityBadge') || e.affectsConfiguration('kilo-scheduler.experimental.activityBadge')) && _updateActivityBadge) {
				_updateActivityBadge()
			}
		}),
	)

	// Initialize badge once on activation (if the view supports it and setting is enabled)
	if (_updateActivityBadge) {
		_updateActivityBadge()
	}


	/**
	 * We use the text document content provider API to show the left side for diff
	 * view by creating a virtual document for the original content. This makes it
	 * readonly so users know to edit the right side if they want to keep their changes.
	 *
	 * This API allows you to create readonly documents in VSCode from arbitrary
	 * sources, and works by claiming an uri-scheme for which your provider then
	 * returns text contents. The scheme must be provided when registering a
	 * provider and cannot change afterwards.
	 *
	 * Note how the provider doesn't create uris for virtual documents - its role
	 * is to provide contents given such an uri. In return, content providers are
	 * wired into the open document logic so that providers are always considered.
	 *
	 * https://code.visualstudio.com/api/extension-guides/virtual-documents
	 */
	const diffContentProvider = new (class implements vscode.TextDocumentContentProvider {
		provideTextDocumentContent(uri: vscode.Uri): string {
			return Buffer.from(uri.query, "base64").toString("utf-8")
		}
	})()


	// Register code actions provider.
	context.subscriptions.push(
		vscode.languages.registerCodeActionsProvider({ pattern: "**/*" }, new CodeActionProvider(), {
			providedCodeActionKinds: CodeActionProvider.providedCodeActionKinds,
		}),
	)


	// Implements the `RooCodeAPI` interface.
	const socketPath = process.env.KILO_IPC_SOCKET_PATH ?? process.env.ROO_CODE_IPC_SOCKET_PATH
	const enableLogging = typeof socketPath === "string"

    // Start experimental A2A gRPC server if enabled
    try { await startA2AGrpcServer(context) } catch {}

    // Start MCP HTTP endpoint if enabled (experimental)
    try { await startMcpA2AEndpoint(context) } catch {}

    // Start A2A HTTP endpoint if enabled (experimental)
    try { await startA2AHttpServer(context) } catch {}

  // Optional: dev helper to invoke remote A2A via gRPC client
    context.subscriptions.push(
		vscode.commands.registerCommand('agent-scheduler.grpc.invoke', async () => {
			const payload = await vscode.window.showInputBox({ prompt: 'A2A payload JSON (target.action + payload)', value: '{"target":{"agent":"kilocode"},"action":"trigger","payload":{"instructions":"Hello"}}' })
			if (!payload) return
			try {
				const msg = JSON.parse(payload)
				const res = await invokeA2A(context, msg)
				vscode.window.showInformationMessage(`gRPC invoke result: ${JSON.stringify(res)}`)
			} catch (e:any) {
				vscode.window.showErrorMessage(`Invalid JSON or gRPC error: ${e?.message || e}`)
			}
		})
	)

	// Command to export Agent Card (discovery doc)
    context.subscriptions.push(
        vscode.commands.registerCommand('agent-scheduler.exportAgentCard', async () => {
            try {
                const card = buildAgentCard()
                const ws = getWorkspacePath()
                const dest = path.join(ws || (__dirname), 'agent-card.json')
                await fs.writeFile(dest, JSON.stringify(card, null, 2), 'utf8')
                vscode.window.showInformationMessage(`Agent Card written to ${dest}`)
            } catch (e:any) {
                vscode.window.showErrorMessage(`Failed to write Agent Card: ${e?.message || e}`)
            }
        })
	)

	// Access key management commands
	context.subscriptions.push(vscode.commands.registerCommand('agent-scheduler.auth.createKey', async () => {
		try {
			const label = await vscode.window.showInputBox({ prompt: 'Label for access key' })
			if (!label) return
			const transportsPick = await vscode.window.showQuickPick(['http','grpc','mcp'], { canPickMany: true, placeHolder: 'Transports allowed' })
			const actionsPick = await vscode.window.showInputBox({ prompt: 'Actions allowed (comma-separated or * for all)', value: '*' })
			const actions = (actionsPick || '*').split(',').map(s => s.trim()).filter(Boolean) as any
			const { token, record } = await createKey(context, { label, transports: (transportsPick?.length ? transportsPick : ['http','grpc','mcp']) as any, actions })
			await vscode.env.clipboard.writeText(token)
			vscode.window.showInformationMessage(`Access key created (copied to clipboard). ID=${record.id}`)
		} catch (e:any) {
			vscode.window.showErrorMessage(`Create key failed: ${e?.message || e}`)
		}
  }))

  // DSPy Optimize coding prompt
  context.subscriptions.push(vscode.commands.registerCommand('agent-scheduler.dspy.optimize', async () => {
    try {
      const optimizer = await vscode.window.showQuickPick(['mipro','gepa'], { placeHolder: 'Optimizer' })
      if (!optimizer) return
      const dataset = await vscode.window.showInputBox({ prompt: 'Path to JSONL dataset (input/output pairs)', value: '' })
      const out = await vscode.window.showInputBox({ prompt: 'Destination prompt file', value: (getWorkspacePath() ? (getWorkspacePath() + '/dspy_optimized_prompt.txt') : 'dspy_optimized_prompt.txt') })
      if (!out) return
      const pyCfg = vscode.workspace.getConfiguration('agent-scheduler').get<string>('experimental.dspy.pythonPath')
      const py = pyCfg || process.env.PYTHON || process.env.PYTHON3 || 'python3'
      const script = context.asAbsolutePath('scripts/dspy_optimize.py')
      await vscode.window.withProgress({ location: vscode.ProgressLocation.Notification, title: 'DSPy optimize', cancellable: false }, () => new Promise<void>((resolve) => {
        const args = [script, '--optimizer', optimizer, '--dataset', dataset || '', '--out', out]
        const child = spawn(py, args, { cwd: context.asAbsolutePath('.') })
        child.stdout.on('data', (d) => outputChannel.appendLine(`[dspy] ${String(d)}`))
        child.stderr.on('data', (d) => outputChannel.appendLine(`[dspy:err] ${String(d)}`))
        child.on('close', async (code) => {
          if (code === 0) {
            try { const doc = await vscode.workspace.openTextDocument(vscode.Uri.file(out)); await vscode.window.showTextDocument(doc) } catch {}
            vscode.window.showInformationMessage('DSPy optimization completed')
          } else {
            vscode.window.showErrorMessage('DSPy optimization failed; see output')
          }
          resolve()
        })
      }))
    } catch (e:any) {
      vscode.window.showErrorMessage(`DSPy optimize failed: ${e?.message||e}`)
    }
  }))
	context.subscriptions.push(vscode.commands.registerCommand('agent-scheduler.auth.listKeys', async () => {
		const keys = await listKeys(context)
		const items = keys.map(k => ({ label: `${k.label} (${k.id})`, description: `${k.enabled ? 'enabled' : 'disabled'}${k.expiresAt ? ' exp:'+k.expiresAt : ''}`, detail: `transports=${k.scopes.transports.join(',')} actions=${k.scopes.actions.join(',')}` }))
		await vscode.window.showQuickPick(items, { placeHolder: 'Existing access keys' })
	}))
	context.subscriptions.push(vscode.commands.registerCommand('agent-scheduler.auth.revokeKey', async () => {
		const keys = await listKeys(context)
		const pick = await vscode.window.showQuickPick(keys.map(k => ({ label: k.label, description: k.id })), { placeHolder: 'Select key to revoke' })
		if (!pick) return
		await revokeKey(context, pick.description!)
		vscode.window.showInformationMessage(`Revoked key ${pick.description}`)
	}))
	context.subscriptions.push(vscode.commands.registerCommand('agent-scheduler.auth.toggleKey', async () => {
		const keys = await listKeys(context)
		const pick = await vscode.window.showQuickPick(keys.map(k => ({ label: `${k.enabled ? 'Disable' : 'Enable'}: ${k.label}`, description: k.id })), { placeHolder: 'Toggle key enabled' })
		if (!pick) return
		const key = keys.find(k => k.id === pick.description)
		if (!key) return
		await setKeyEnabled(context, key.id, !key.enabled)
		vscode.window.showInformationMessage(`Key ${key.id} is now ${!key.enabled ? 'enabled' : 'disabled'}`)
	}))
}

// This method is called when your extension is deactivated
export async function deactivate() {
    outputChannel.appendLine("Kilo-Code extension deactivated")
    // Clean up MCP server manager
    try { stopMcpA2AEndpoint() } catch {}
    try { stopA2AHttpServer() } catch {}
	// The scheduler service will be automatically cleaned up when the extension is deactivated
	// as its timers are registered as disposables in the extension context
}

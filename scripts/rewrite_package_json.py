import re, json

src = open('package.json','rb').read().decode('utf-8','replace')

def extract_block(key):
    # find a top-level key like "scripts": { ... }
    pat = re.compile(r'"%s"\s*:\s*\{' % re.escape(key))
    m = pat.search(src)
    if not m: return None
    i = m.end()-1  # position at '{'
    level = 0
    in_s = False
    esc = False
    start = i
    for j in range(i, len(src)):
        ch = src[j]
        if in_s:
            if esc:
                esc = False
            elif ch == '\\':
                esc = True
            elif ch == '"':
                in_s = False
        else:
            if ch == '"':
                in_s = True
            elif ch == '{':
                level += 1
            elif ch == '}':
                level -= 1
                if level == 0:
                    return src[m.start():j+1]
    return None

def extract_value(key):
    blk = extract_block(key)
    if not blk: return None
    # Make it valid JSON by wrapping with braces
    text = '{'+blk+'}'
    try:
        obj = json.loads(text)
        return obj[key]
    except Exception:
        return None

def read_field(field):
    # try to read a simple string field from head
    m = re.search(r'"%s"\s*:\s*"([^"]*)"' % re.escape(field), src)
    return m.group(1) if m else None

result = {}
for k in ['name','displayName','description','publisher','version','icon','homepage']:
    v = read_field(k)
    if v is not None:
        result[k] = v
result['galleryBanner'] = { 'color':'#617A91','theme':'dark' }
result['engines'] = { 'vscode':'^1.84.0', 'node': '20.18.1' }
result['author'] = { 'name':'Stefan Preu', 'url':'https://github.com/unbraind' }
result['repository'] = { 'type':'git', 'url':'https://github.com/unbrained/IDE-scheduler' }
result['categories'] = ["AI","Chat","Programming Languages","Education","Snippets","Testing"]
result['keywords'] = ["claude","dev","mcp","openrouter","coding","agent","autonomous","chatgpt","sonnet","ai","llama","scheduler","kilo","kilo-code","kilo-scheduler"]
result['activationEvents'] = [
    'onStartupFinished','onView:agent-scheduler.SidebarProvider','onCommand:agent-scheduler.openAgentScheduler'
]
result['main'] = './dist/extension.js'
result['extensionDependencies'] = ['kilocode.kilo-code']

# Contributes: rebuild cleanly with only agent-scheduler.* and fixed view container
action_enum = { 'type':'string','enum':['trigger','list','setActive','message','task.create','task.get','task.list','task.cancel'] }
basic_enum = { 'type':'string','enum':['trigger','list','setActive'] }
props = {
  'agent-scheduler.experimental.activityBadge': { 'type':'boolean','default':False,'description':'Show active schedule count on Activity Bar icon (experimental).'},
  'agent-scheduler.experimental.crossIde': { 'type':'boolean','default':False,'description':'Enable cross-IDE scheduling + Agent-to-Agent triggers (experimental).'},
  'agent-scheduler.experimental.autoMapOnStartup': { 'type':'boolean','default':True,'description':'On activation, discover installed agent extensions and prefill trigger/list commands when missing.'},
  'agent-scheduler.experimental.http.enabled': { 'type':'boolean','default':False,'description':'Enable built-in HTTP A2A endpoint.'},
  'agent-scheduler.experimental.http.host': { 'type':'string','default':'127.0.0.1','description':'HTTP host/interface for A2A endpoint.'},
  'agent-scheduler.experimental.http.port': { 'type':'number','default':50252,'description':'HTTP port for A2A endpoint.'},
  'agent-scheduler.experimental.http.basePath': { 'type':'string','default':'/a2a','description':'Base path for HTTP A2A endpoint.'},
  'agent-scheduler.experimental.grpc.enabled': { 'type':'boolean','default':False,'description':'Enable built-in gRPC A2A server.'},
  'agent-scheduler.experimental.grpc.host': { 'type':'string','default':'127.0.0.1','description':'gRPC host/interface for A2A server.'},
  'agent-scheduler.experimental.grpc.port': { 'type':'number','default':50251,'description':'gRPC port for A2A server.'},
  'agent-scheduler.experimental.grpc.client.enabled': { 'type':'boolean','default':False,'description':'Enable gRPC client for outbound A2A calls.'},
  'agent-scheduler.experimental.grpc.client.target': { 'type':'string','default':'127.0.0.1:50251','description':'gRPC client target host:port.'},
  'agent-scheduler.experimental.mcp.enabled': { 'type':'boolean','default':False,'description':'Enable MCP integration (experimental).'},
  'agent-scheduler.experimental.mcp.forward': { 'type':'boolean','default':False,'description':'Forward A2A trigger messages over MCP when enabled.'},
  'agent-scheduler.experimental.mcp.endpoint': { 'type':'string','default':'','description':'MCP endpoint URL for outbound messages.'},
  'agent-scheduler.experimental.mcp.http.enabled': { 'type':'boolean','default':False,'description':'Expose MCP HTTP transport (local).'},
  'agent-scheduler.experimental.mcp.http.port': { 'type':'number','default':4025,'description':'Port for MCP HTTP endpoint.'},
  'agent-scheduler.experimental.mcp.http.path': { 'type':'string','default':'/mcp','description':'Base path for MCP HTTP endpoint.'},
  'agent-scheduler.experimental.auth.http.required': { 'type':'boolean','default':False,'description':'Require an access key for HTTP A2A endpoints.'},
  'agent-scheduler.experimental.auth.grpc.required': { 'type':'boolean','default':False,'description':'Require an access key for gRPC A2A server.'},
  'agent-scheduler.experimental.auth.mcp.required': { 'type':'boolean','default':False,'description':'Require an access key for MCP HTTP endpoint.'},
  # DSPy integration
  'agent-scheduler.experimental.dspy.enabled': { 'type':'boolean','default': False, 'description': 'Enable DSPy optimization commands for coding prompts (experimental).'},
  'agent-scheduler.experimental.dspy.pythonPath': { 'type':'string','default': '', 'description': 'Path to Python interpreter with dspy installed (default: python3).'},
  'agent-scheduler.experimental.dspy.optimizer': { 'type':'string','default': 'mipro', 'description': 'DSPy optimizer to use (mipro or gepa).'},
  'agent-scheduler.experimental.dspy.model': { 'type':'string','default': 'gpt-4o-mini', 'description': 'Default LLM model id for DSPy (when supported).'},
}

# Per‑adapter properties (UI)
adapters = [
  ('kilocode', True),
  ('cline', False),
  ('rooCode', False),
  ('continue', False),
  ('cursor', False),
  ('claudeCode', False),
  ('geminiCli', False),
  ('qwenCli', False),
  ('cursorIDE', False),
  ('augmentCode', False),
  ('claudeCodeChat', False),
  ('cursorCli', False),
  ('codexCli', False),
  ('codexOnline', False),
  ('codexVscode', False),
  ('googleCodeAssist', False),
  ('geminiCliCompanion', False),
  ('copilot', False),
  ('windsurfPlugin', False),
  ('windsurfIDE', False),
  ('zed', False),
  ('qodoGen', False),
  ('qoder', False),
  ('amazonQ', False),
]
for aid,full in adapters:
    base = f'agent-scheduler.experimental.agents.{aid}'
    props[f'{base}.enabled'] = { 'type':'boolean','default': aid=='kilocode','description': f'Enable {aid} adapter.' }
    props[f'{base}.allowedActions'] = {
        'type':'array', 'items': (action_enum if full else basic_enum),
        'default': (['trigger','list','setActive','message','task.create','task.get','task.list','task.cancel'] if full else ['trigger']),
        'description': f'Allowed actions for {aid} adapter.'
    }
    props[f'{base}.triggerCommand'] = { 'type':'string','default':'', 'description': f'Override command id to trigger {aid}.' }
    props[f'{base}.listCommand'] = { 'type':'string','default':'', 'description': f'Optional command id to list {aid} tasks/history.' }

contributes = {
  'configuration': {
    'title': 'Agent Scheduler',
    'properties': props
  },
  'viewsContainers': {
    'activitybar': [{ 'id':'agent-scheduler-ActivityBar','title':'Agent Scheduler','icon':'assets/icons/activitybar-scheduler.svg' }]
  },
  'views': {
    'agent-scheduler-ActivityBar': [{ 'type':'webview','id':'agent-scheduler.SidebarProvider','name':'Agent Scheduler' }]
  },
  'commands': [
    { 'command':'agent-scheduler.reloadWindowDev', 'title':'Reload Window (Dev Only)', 'icon':'$(refresh)', 'category':'Developer' },
    { 'command':'agent-scheduler.adapters', 'title':'AgentScheduler: Adapters Manager', 'category':'Agent Scheduler' },
    { 'command':'agent-scheduler.keysManager', 'title':'AgentScheduler: Access Keys Manager', 'category':'Agent Scheduler' },
    { 'command':'agent-scheduler.taskManager', 'title':'AgentScheduler: Task Manager', 'category':'Agent Scheduler' },
    { 'command':'agent-scheduler.getStarted', 'title':'AgentScheduler: Get Started', 'category':'Agent Scheduler' },
    { 'command':'agent-scheduler.validateSetup', 'title':'AgentScheduler: Validate Setup', 'category':'Agent Scheduler' },
    { 'command':'agent-scheduler.dspy.optimize', 'title':'AgentScheduler: DSPy Optimize Coding Prompt', 'category':'Agent Scheduler' },
    { 'command':'agent-scheduler.openAgentScheduler', 'title':'Open Agent Scheduler', 'icon': { 'light':'assets/icons/scheduler-icon-dark.png','dark':'assets/icons/scheduler-icon-light.png' } },
    { 'command':'agent-scheduler.a2a.trigger', 'title':'AgentScheduler: A2A Trigger (Experimental)', 'category':'Agent Scheduler' },
    { 'command':'agent-scheduler.a2a.sample', 'title':'AgentScheduler: Sample A2A Trigger', 'category':'Agent Scheduler' },
    { 'command':'agent-scheduler.grpc.invoke', 'title':'AgentScheduler: gRPC A2A Invoke (Experimental)', 'category':'Agent Scheduler' },
    { 'command':'agent-scheduler.exportAgentCard', 'title':'AgentScheduler: Export Agent Card (Discovery)', 'category':'Agent Scheduler' },
    { 'command':'agent-scheduler.mapAgentCommands', 'title':'AgentScheduler: Map Agent Commands (Discover & Persist)', 'category':'Agent Scheduler' },
    { 'command':'agent-scheduler.auth.createKey', 'title':'AgentScheduler: Create Access Key', 'category':'Agent Scheduler' },
    { 'command':'agent-scheduler.auth.listKeys', 'title':'AgentScheduler: List Access Keys', 'category':'Agent Scheduler' },
    { 'command':'agent-scheduler.auth.revokeKey', 'title':'AgentScheduler: Revoke Access Key', 'category':'Agent Scheduler' },
    { 'command':'agent-scheduler.auth.toggleKey', 'title':'AgentScheduler: Toggle Access Key Enabled', 'category':'Agent Scheduler' }
  ],
  'menus': {
    'view/title': [
      { 'command':'agent-scheduler.reloadWindowDev','group':'navigation@0','when':'view == agent-scheduler.SidebarProvider && kiloSchedulerDevMode' },
      { 'command':'agent-scheduler.adapters','group':'navigation@2','when':'view == agent-scheduler.SidebarProvider' },
      { 'command':'agent-scheduler.keysManager','group':'navigation@3','when':'view == agent-scheduler.SidebarProvider' },
      { 'command':'agent-scheduler.getStarted','group':'navigation@1','when':'view == agent-scheduler.SidebarProvider' },
      { 'command':'agent-scheduler.validateSetup','group':'navigation@4','when':'view == agent-scheduler.SidebarProvider' },
      { 'command':'agent-scheduler.dspy.optimize','group':'navigation@5','when':'view == agent-scheduler.SidebarProvider' },
      { 'command':'agent-scheduler.openAgentScheduler','group':'navigation@9','when':'view == agent-scheduler.SidebarProvider' }
    ]
  },
  'viewsWelcome': [
    { 'view':'agent-scheduler.SidebarProvider', 'contents':'Welcome to Agent Scheduler.\n[Open Scheduler](command:agent-scheduler.openAgentScheduler) \nConfigure adapters in Settings to enable cross‑IDE triggers.', 'when':'!config.agent-scheduler.experimental.crossIde' },
    { 'view':'agent-scheduler.SidebarProvider', 'contents':'Cross‑IDE mode is enabled.\nUse AgentScheduler: Map Agent Commands to discover adapters.', 'when':'config.agent-scheduler.experimental.crossIde' }
  ]
}

result['contributes'] = contributes

# Extract large sections from existing file when possible
for key in ['scripts','dependencies','devDependencies','lint-staged']:
    v = extract_value(key)
    if v is not None:
        result[key] = v

open('package.json','wb').write((json.dumps(result, indent=2) + '\n').encode('utf-8'))
print('Rewrote package.json successfully')

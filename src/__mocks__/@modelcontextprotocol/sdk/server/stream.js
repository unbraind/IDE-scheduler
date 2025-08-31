module.exports = {
  StreamableHTTPServerTransport: class {
    async handleRequest(_server, _req, res, body) {
      try {
        const payload = JSON.parse(body || '{}')
        const fn = (global.__MCP_TOOLS__ || {})['a2a.invoke']
        const out = fn ? await fn(payload) : { content: [{ type: 'text', text: JSON.stringify({ ok: false, error: 'no-tool' }) }] }
        const text = out?.content?.[0]?.text || JSON.stringify({ ok: false })
        res.writeHead(200, { 'content-type': 'application/json' })
        res.end(text)
      } catch (e) {
        res.writeHead(500)
        res.end(JSON.stringify({ ok: false, error: String(e?.message || e) }))
      }
    }
  }
}


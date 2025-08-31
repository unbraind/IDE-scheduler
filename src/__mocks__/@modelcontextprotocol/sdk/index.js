const { Client } = require("./client/index.js")
const { StdioClientTransport, StdioServerParameters } = require("./client/stdio.js")
const {
	CallToolResultSchema,
	ListToolsResultSchema,
	ListResourcesResultSchema,
	ListResourceTemplatesResultSchema,
	ReadResourceResultSchema,
	ErrorCode,
	McpError,
} = require("./types.js")

module.exports = {
	Client,
	StdioClientTransport,
	StdioServerParameters,
	// Minimal McpServer mock used by tests and endpoint scaffolding
	McpServer: class {
		constructor(opts) { this.name = opts?.name || 'mock'; this._tools = {} }
		tool(name, { handler }) { this._tools[name] = handler; global.__MCP_TOOLS__ = global.__MCP_TOOLS__ || {}; global.__MCP_TOOLS__[name] = handler }
	},
	CallToolResultSchema,
	ListToolsResultSchema,
	ListResourcesResultSchema,
	ListResourceTemplatesResultSchema,
	ReadResourceResultSchema,
	ErrorCode,
	McpError,
}

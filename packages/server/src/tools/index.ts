import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { DevToolsProxy } from '../proxy.js'
import { registerDiscoveryTools } from './discovery.tool.js'
import { registerRoutesTools } from './routes.tool.js'
import { registerConfigTools } from './config.tool.js'
import { registerLogsTools } from './logs.tool.js'
import { registerHistoryTools } from './history.tool.js'
import { registerErrorsTools } from './errors.tool.js'
import { registerClearBuffersTool } from './clear-buffers.tool.js'
import { registerDiagnoseHealthTool } from './diagnose-health.tool.js'

export function registerAllTools(server: McpServer, devtoolsProxy: DevToolsProxy) {
  registerDiscoveryTools(server, devtoolsProxy)
  registerRoutesTools(server, devtoolsProxy)
  registerConfigTools(server, devtoolsProxy)
  registerLogsTools(server, devtoolsProxy)
  registerHistoryTools(server, devtoolsProxy)
  registerErrorsTools(server, devtoolsProxy)
  registerClearBuffersTool(server, devtoolsProxy)
  registerDiagnoseHealthTool(server, devtoolsProxy)
}

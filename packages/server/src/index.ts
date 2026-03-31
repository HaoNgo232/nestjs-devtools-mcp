#!/usr/bin/env node
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import { z } from 'zod';
import { discoverServers } from './discovery.js';
import { DevToolsProxy } from './proxy.js';

/**
 * NestJS DevTools MCP - Bridge khởi chạy qua STDIO transport.
 * AI Client sẽ spawn process này để tương tác với NestJS App.
 */
const server = new Server(
  {
    name: 'nestjs-devtools-mcp',
    version: '0.1.0',
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

const devtoolsProxy = new DevToolsProxy();

/**
 * Đăng ký danh sách các tool khả dụng cho AI Client.
 */
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: 'discover_servers',
        description: 'Quét localhost để tìm các NestJS servers đang tích hợp plugin DevTools.',
        inputSchema: {
          type: 'object',
          properties: {},
        },
      },
      {
        name: 'get_logs',
        description: 'Lấy danh sách log runtime của NestJS server đang chạy (Buffer logs).',
        inputSchema: {
          type: 'object',
          properties: {
            port: {
              type: 'number',
              description: 'Cổng của NestJS server (VD: 3000). Nếu chỉ có 1 server, sẽ tự động dùng server đó.',
            },
            lines: {
              type: 'number',
              description: 'Số dòng log muốn lấy (mặc định: 50).',
            },
            level: {
              type: 'string',
              enum: ['all', 'log', 'error', 'warn', 'debug', 'verbose'],
              description: 'Lọc log theo level.',
            },
          },
        },
      },
    ],
  };
});

/**
 * Xử lý yêu cầu Tool Call từ AI Client và proxy/thực hiện logic bridge.
 */
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  try {
    switch (name) {
      case 'discover_servers': {
        const servers = await discoverServers();
        return {
          content: [{ type: 'text', text: JSON.stringify(servers, null, 2) }],
        };
      }

      case 'get_logs': {
        const schema = z.object({
          port: z.number().optional(),
          lines: z.number().optional(),
          level: z.string().optional(),
        });
        const parsed = schema.parse(args || {});
        
        const targetPort = await devtoolsProxy.resolvePort(parsed.port);
        const logData = await devtoolsProxy.callPluginTool(targetPort, 'get_logs', {
          lines: parsed.lines,
          level: parsed.level,
        });

        return {
          content: [{ type: 'text', text: JSON.stringify(logData, null, 2) }],
        };
      }

      default:
        throw new Error(`Tool không được hỗ trợ: ${name}`);
    }
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    return {
      content: [{ type: 'text', text: errorMessage }],
      isError: true,
    };
  }
});

/**
 * Khởi tạo transport và bắt đầu lắng nghe STDIO.
 */
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('NestJS DevTools MCP Bridge đã khởi chạy và đang lắng nghe STDIO.');
}

main().catch((err) => {
  console.error('Lỗi nghiêm trọng khi khởi chạy NestJS DevTools bridge:', err);
  process.exit(1);
});

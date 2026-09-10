import { z } from 'zod'
import { ResponseFormatSchema } from './common.schema.js'

export const DiscoverServersInputSchema = {
  start_port: z
    .number()
    .int()
    .min(1)
    .max(65535)
    .optional()
    .describe('Starting port of the scan range (default: 3000 or NESTJS_MCP_SCAN_START).'),
  end_port: z
    .number()
    .int()
    .min(1)
    .max(65535)
    .optional()
    .describe('Ending port of the scan range (default: 3010 or NESTJS_MCP_SCAN_END).'),
  response_format: ResponseFormatSchema,
}

export const DiscoverServersSchema = z.object(DiscoverServersInputSchema)
export type DiscoverServersInput = z.infer<typeof DiscoverServersSchema>

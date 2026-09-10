import { z } from 'zod'
import { ResponseFormatSchema, TargetPortSchema } from './common.schema.js'
import { ResponseFormat } from '../types.js'

export const GetRoutesInputSchema = {
  port: TargetPortSchema,
  method: z
    .string()
    .optional()
    .describe("Filter routes by HTTP method (e.g. 'GET', 'POST', 'PUT', 'DELETE', 'PATCH'). Case-insensitive."),
  path_contains: z
    .string()
    .optional()
    .describe("Filter routes where URL path contains this substring (e.g. '/api', '/users'). Case-insensitive."),
  pathContains: z.string().optional().describe('Deprecated alias for path_contains.'),
  response_format: ResponseFormatSchema,
}

export interface GetRoutesInput {
  port?: number
  method?: string
  path_contains?: string
  pathContains?: string
  response_format?: ResponseFormat
}

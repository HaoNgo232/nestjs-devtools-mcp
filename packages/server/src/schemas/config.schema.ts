import { z } from 'zod'
import { ResponseFormatSchema, TargetPortSchema } from './common.schema.js'
import { ResponseFormat } from '../types.js'

export const ConfigSourceSchema = z
  .enum(['all', 'env', 'config-service'])
  .default('all')
  .describe("Configuration source to inspect: 'all', 'env', or 'config-service' (default: 'all').")

export const GetConfigInputSchema = {
  port: TargetPortSchema,
  source: ConfigSourceSchema.optional(),
  key_contains: z
    .string()
    .optional()
    .describe('Filter configuration keys containing this substring (case-insensitive).'),
  keyContains: z.string().optional().describe('Deprecated alias for key_contains.'),
  include_masked: z
    .boolean()
    .default(true)
    .optional()
    .describe('Include keys whose values are masked because they contain sensitive data (default: true).'),
  includeMasked: z.boolean().optional().describe('Deprecated alias for include_masked.'),
  response_format: ResponseFormatSchema,
}

export type ConfigSourceType = 'all' | 'env' | 'config-service'

export interface GetConfigInput {
  port?: number
  source?: ConfigSourceType
  key_contains?: string
  keyContains?: string
  include_masked?: boolean
  includeMasked?: boolean
  response_format?: ResponseFormat
}

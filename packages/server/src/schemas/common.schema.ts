import { z } from 'zod'
import { ResponseFormat } from '../types.js'
import { DEFAULT_PAGE_LIMIT, MAX_PAGE_LIMIT } from '../constants.js'

export const ResponseFormatSchema = z
  .nativeEnum(ResponseFormat)
  .default(ResponseFormat.MARKDOWN)
  .describe("Output format: 'markdown' for formatted readable text or 'json' for machine-readable JSON.")

export const TargetPortSchema = z
  .number()
  .int()
  .positive()
  .optional()
  .describe('NestJS server port (e.g. 3000). Auto-detected if only 1 server is active.')

export const PaginationInputSchema = {
  limit: z
    .number()
    .int()
    .min(1)
    .max(MAX_PAGE_LIMIT)
    .default(DEFAULT_PAGE_LIMIT)
    .describe(`Max results to return (1-${MAX_PAGE_LIMIT}, default: ${DEFAULT_PAGE_LIMIT}).`),
  offset: z.number().int().min(0).default(0).describe('Number of records to skip for pagination (default: 0).'),
}

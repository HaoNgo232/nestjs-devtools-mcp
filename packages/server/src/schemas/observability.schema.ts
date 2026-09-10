import { z } from 'zod'
import { TargetPortSchema, ResponseFormatSchema } from './common.schema.js'
import { DEFAULT_PAGE_LIMIT, MAX_PAGE_LIMIT } from '../constants.js'

export const GetLogsInputSchema = {
  port: TargetPortSchema,
  limit: z
    .number()
    .int()
    .min(1)
    .max(MAX_PAGE_LIMIT)
    .default(DEFAULT_PAGE_LIMIT)
    .describe(`Max results to return (1-${MAX_PAGE_LIMIT}, default: ${DEFAULT_PAGE_LIMIT}).`),
  lines: z
    .number()
    .int()
    .min(1)
    .max(MAX_PAGE_LIMIT)
    .optional()
    .describe(`Alias for limit: maximum log lines to retrieve (1-${MAX_PAGE_LIMIT}).`),
  offset: z.number().int().min(0).default(0).describe('Number of records to skip for pagination (default: 0).'),
  level: z
    .enum(['all', 'log', 'error', 'warn', 'debug', 'verbose'])
    .optional()
    .describe("Filter logs by level ('all', 'log', 'error', 'warn', 'debug', 'verbose')."),
  request_id: z.string().nullable().optional().describe('Filter logs by request correlation ID.'),
  requestId: z.string().nullable().optional().describe('Alias for request_id: filter logs by request correlation ID.'),
  response_format: ResponseFormatSchema,
}

export const GetLogsSchema = z.object(GetLogsInputSchema)
export type GetLogsInput = z.infer<typeof GetLogsSchema>

export const GetRequestHistoryInputSchema = {
  port: TargetPortSchema,
  limit: z
    .number()
    .int()
    .min(1)
    .max(MAX_PAGE_LIMIT)
    .default(DEFAULT_PAGE_LIMIT)
    .describe(`Max results to return (1-${MAX_PAGE_LIMIT}, default: ${DEFAULT_PAGE_LIMIT}).`),
  offset: z.number().int().min(0).default(0).describe('Number of records to skip for pagination (default: 0).'),
  method: z.string().optional().describe('Filter by HTTP method (e.g., GET, POST, PUT, DELETE).'),
  status_code: z.number().int().optional().describe('Filter by exact HTTP status code.'),
  statusCode: z.number().int().optional().describe('Alias for status_code: filter by exact HTTP status code.'),
  status_class: z
    .enum(['2xx', '3xx', '4xx', '5xx'])
    .optional()
    .describe("Filter by HTTP status class ('2xx', '3xx', '4xx', '5xx')."),
  statusClass: z
    .enum(['2xx', '3xx', '4xx', '5xx'])
    .optional()
    .describe('Alias for status_class: filter by HTTP status class.'),
  path_contains: z.string().optional().describe('Filter to requests whose path contains this substring.'),
  pathContains: z
    .string()
    .optional()
    .describe('Alias for path_contains: filter to requests whose path contains this substring.'),
  min_duration_ms: z
    .number()
    .min(0)
    .optional()
    .describe('Filter to requests that took at least this many milliseconds.'),
  minDurationMs: z
    .number()
    .min(0)
    .optional()
    .describe('Alias for min_duration_ms: filter to requests that took at least this many milliseconds.'),
  only_errors: z.boolean().optional().describe('Return only failed or error requests.'),
  onlyErrors: z.boolean().optional().describe('Alias for only_errors: return only failed or error requests.'),
  request_id: z.string().nullable().optional().describe('Filter by request correlation ID.'),
  requestId: z.string().nullable().optional().describe('Alias for request_id: filter by request correlation ID.'),
  response_format: ResponseFormatSchema,
}

export const GetRequestHistorySchema = z.object(GetRequestHistoryInputSchema)
export type GetRequestHistoryInput = z.infer<typeof GetRequestHistorySchema>

export const GetErrorsInputSchema = {
  port: TargetPortSchema,
  limit: z
    .number()
    .int()
    .min(1)
    .max(MAX_PAGE_LIMIT)
    .default(DEFAULT_PAGE_LIMIT)
    .describe(`Max results to return (1-${MAX_PAGE_LIMIT}, default: ${DEFAULT_PAGE_LIMIT}).`),
  offset: z.number().int().min(0).default(0).describe('Number of records to skip for pagination (default: 0).'),
  source: z
    .enum(['bootstrap', 'runtime', 'unhandled', 'http-5xx'])
    .optional()
    .describe("Filter by error source ('bootstrap', 'runtime', 'unhandled', 'http-5xx')."),
  since: z.number().optional().describe('Unix timestamp (ms). Only return errors occurring after this time.'),
  request_id: z.string().nullable().optional().describe('Filter by request correlation ID.'),
  requestId: z.string().nullable().optional().describe('Alias for request_id: filter by request correlation ID.'),
  only_unhandled: z.boolean().optional().describe('Return only unhandled and bootstrap errors.'),
  onlyUnhandled: z
    .boolean()
    .optional()
    .describe('Alias for only_unhandled: return only unhandled and bootstrap errors.'),
  include_stack: z.boolean().optional().describe('Include stack traces in output (forced false in production).'),
  includeStack: z.boolean().optional().describe('Alias for include_stack: include stack traces in output.'),
  response_format: ResponseFormatSchema,
}

export const GetErrorsSchema = z.object(GetErrorsInputSchema)
export type GetErrorsInput = z.infer<typeof GetErrorsSchema>

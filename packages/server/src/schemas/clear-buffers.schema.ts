import { z } from 'zod'
import { TargetPortSchema } from './common.schema.js'

export const ClearBuffersInputSchema = {
  port: TargetPortSchema,
  target: z
    .enum(['all', 'logs', 'history', 'errors'])
    .default('all')
    .describe("Buffer target to purge: 'all' (default), 'logs', 'history', or 'errors'."),
}

export const ClearBuffersZodSchema = z.object(ClearBuffersInputSchema)
export type ClearBuffersInput = z.infer<typeof ClearBuffersZodSchema>

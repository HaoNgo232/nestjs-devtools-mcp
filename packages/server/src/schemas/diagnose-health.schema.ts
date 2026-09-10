import { z } from 'zod'
import { TargetPortSchema, ResponseFormatSchema } from './common.schema.js'

export const DiagnoseHealthInputSchema = {
  port: TargetPortSchema,
  recent_errors_limit: z
    .number()
    .int()
    .min(1)
    .max(10)
    .default(3)
    .describe('Number of recent crash/5xx errors to retrieve with correlated logs (1-10, default: 3).'),
  response_format: ResponseFormatSchema,
}

export const DiagnoseHealthZodSchema = z.object(DiagnoseHealthInputSchema)
export type DiagnoseHealthInput = z.infer<typeof DiagnoseHealthZodSchema>

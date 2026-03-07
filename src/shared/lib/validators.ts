import { z } from 'zod'

export const moneySchema = z.number().nonnegative()
export const optionalTextSchema = z.string().trim().optional()

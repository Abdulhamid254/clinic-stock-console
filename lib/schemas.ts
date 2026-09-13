import { z } from 'zod';

export const loginSchema = z.object({
  username: z.string().min(1, 'Username is required'),
  password: z.string().min(1, 'Password is required'),
});
export type LoginFormValues = z.infer<typeof loginSchema>;

export const stockCorrectionSchema = z.object({
  stock: z.coerce
    .number({ invalid_type_error: 'Enter a whole number' })
    .int('Stock must be a whole number')
    .min(0, 'Stock cannot be negative')
    .max(100000, 'Stock seems unreasonably high — double check this value'),
});
export type StockCorrectionValues = z.infer<typeof stockCorrectionSchema>;

export const PAGE_SIZE = 12;

export const SORT_FIELDS = ['title', 'price', 'stock'] as const;
export const SORT_ORDERS = ['asc', 'desc'] as const;

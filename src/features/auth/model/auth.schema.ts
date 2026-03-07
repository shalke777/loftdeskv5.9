import { z } from 'zod'

export const loginSchema = z.object({
  email: z.string().email('Podaj poprawny adres e-mail'),
  password: z.string().min(6, 'Hasło musi mieć min. 6 znaków'),
})

export const registerSchema = z.object({
  email: z.string().email('Podaj poprawny adres e-mail'),
  password: z.string().min(8, 'Hasło musi mieć min. 8 znaków'),
  companyName: z.string().min(2, 'Podaj nazwę firmy'),
  fullName: z.string().min(2, 'Podaj imię i nazwisko'),
  nip: z.string().min(0).max(20).optional().default(''),
})

export const forgotPasswordSchema = z.object({
  email: z.string().email('Podaj poprawny adres e-mail'),
})

export type LoginInput = z.infer<typeof loginSchema>
export type RegisterInput = z.infer<typeof registerSchema>
export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>

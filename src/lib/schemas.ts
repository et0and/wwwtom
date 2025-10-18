import { z } from "zod";

// Supported currencies for products
const supportedCurrencies = z.enum(["usd", "eur", "gbp"]);

// Schema for dynamic product creation via webhook
export const dynamicProductCreateSchema = z.object({
  name: z.string().min(1).max(255).trim(),
  description: z.string().max(1000).trim().optional(),
  price: z.number().positive().max(100000000), // Max $1M
  currency: supportedCurrencies.default("usd"),
});

// Schema for customer form data
export const customerFormSchema = z.object({
  firstName: z.string().min(1).max(100).trim(),
  lastName: z.string().min(1).max(100).trim(),
  email: z.string().email().max(254),
  phone: z.string().regex(/^[0-9+\-\s\(\)]+$/).min(7).max(20), // Basic phone validation
});

// Schema for product selection (ID validation)
export const productSelectionSchema = z.object({
  productId: z.string().uuid(), // Assuming Polar uses UUIDs
});

// Schema for API responses
export const apiResponseSchema = z.object({
  success: z.boolean(),
  productId: z.string().uuid().optional(),
  error: z.string().optional(),
});

// Schema for dynamic product from database
export const dynamicProductSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  description: z.string().optional(),
  price: z.number(),
  currency: supportedCurrencies,
  polarId: z.string().uuid(),
});

// Schema for static product (subset of Polar's ProductCreate)
export const staticProductSchema = z.object({
  id: z.string().uuid().optional(), // May not have ID until created
  name: z.string(),
  recurringInterval: z.null(), // Only one-off
  prices: z.array(z.object({
    amountType: z.literal("fixed"),
    priceAmount: z.number().positive(),
    priceCurrency: supportedCurrencies,
  })),
  organizationId: z.string().uuid(),
});

// Type exports for TypeScript
export type DynamicProductCreate = z.infer<typeof dynamicProductCreateSchema>;
export type CustomerForm = z.infer<typeof customerFormSchema>;
export type ProductSelection = z.infer<typeof productSelectionSchema>;
export type ApiResponse = z.infer<typeof apiResponseSchema>;
export type DynamicProduct = z.infer<typeof dynamicProductSchema>;
export type StaticProduct = z.infer<typeof staticProductSchema>;

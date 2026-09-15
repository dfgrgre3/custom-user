import { z } from 'zod';

/**
 * Runtime validation for the customer API's response shape. `ExternalUser`
 * (customer-api.types.ts) is a compile-time-only guarantee — it says
 * nothing about what the API actually sends back at runtime. Without this,
 * a malformed or unexpectedly-shaped response (e.g. `status: "deleted"`,
 * a missing field, `data` not being an array) would sail through as a cast
 * (`as ExternalUserStatus`) and only blow up later — either silently
 * (wrong data synced) or as an opaque Postgres enum-violation error deep
 * inside the sync transaction.
 *
 * Validating here, at the network boundary, means a contract violation is
 * caught immediately and reported as what it is.
 */

export const externalUserStatusSchema = z.enum([
  'active',
  'invited',
  'suspended',
]);

export const externalCompanySchema = z.object({
  name: z.string(),
  industry: z.string(),
  role: z.string(),
  website: z.string().optional(),
  employees: z.number().optional(),
});

export const externalUserSchema = z.object({
  id: z.string(),
  name: z.string(),
  email: z.string(),
  phone: z.string().optional(),
  status: externalUserStatusSchema,
  company: externalCompanySchema,
  createdAt: z.string(),
  updatedAt: z.string(),
});

export const externalPaginationSchema = z.object({
  page: z.number(),
  limit: z.number(),
  total: z.number(),
  totalPages: z.number(),
  hasNextPage: z.boolean(),
  hasPrevPage: z.boolean(),
});

export const externalUserListResponseSchema = z.object({
  data: z.array(externalUserSchema),
  pagination: externalPaginationSchema,
});

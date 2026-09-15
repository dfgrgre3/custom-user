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
 * caught immediately and reported as what it is. Fields are deliberately
 * strict, not just "is a string": an empty name, an unparseable date, or a
 * malformed email should fail loudly here rather than reach the database
 * as garbage (e.g. `new Date("not-a-date")` producing `Invalid Date`, which
 * later fails opaquely at `.toISOString()`).
 */

export const externalUserStatusSchema = z.enum([
  'active',
  'invited',
  'suspended',
]);

const nonEmptyString = (field: string) =>
  z.string().trim().min(1, `${field} must not be empty.`);

export const externalCompanySchema = z.object({
  name: nonEmptyString('company.name'),
  industry: nonEmptyString('company.industry'),
  role: nonEmptyString('company.role'),
  website: z.string().url('company.website must be a valid URL.').optional(),
  employees: z.number().int().nonnegative().optional(),
});

export const externalUserSchema = z.object({
  id: nonEmptyString('id'),
  name: nonEmptyString('name'),
  email: z.string().email('email must be a valid email address.'),
  phone: z.string().optional(),
  status: externalUserStatusSchema,
  company: externalCompanySchema,
  createdAt: z.string().datetime({
    offset: true,
    message: 'createdAt must be a valid ISO 8601 datetime.',
  }),
  updatedAt: z.string().datetime({
    offset: true,
    message: 'updatedAt must be a valid ISO 8601 datetime.',
  }),
});

export const externalPaginationSchema = z.object({
  page: z.number().int().positive(),
  limit: z.number().int().positive(),
  total: z.number().int().nonnegative(),
  totalPages: z.number().int().nonnegative(),
  hasNextPage: z.boolean(),
  hasPrevPage: z.boolean(),
});

export const externalUserListResponseSchema = z
  .object({
    data: z.array(externalUserSchema),
    pagination: externalPaginationSchema,
  })
  // Rejects duplicate ids within a single page here, at the earliest
  // possible point, rather than letting them reach the RPC layer where
  // `sync_users()` would also reject them (see supabase/migrations/004) —
  // failing fast in the client gives a clearer error message and one fewer
  // round trip to the database for something we can already tell is wrong.
  .refine(
    (response) => {
      const ids = response.data.map((user) => user.id);
      return new Set(ids).size === ids.length;
    },
    { message: 'Response contains duplicate user ids within one page.' },
  );

"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.externalUserListResponseSchema = exports.externalPaginationSchema = exports.externalUserSchema = exports.externalCompanySchema = exports.externalUserStatusSchema = void 0;
const zod_1 = require("zod");
exports.externalUserStatusSchema = zod_1.z.enum([
    'active',
    'invited',
    'suspended',
]);
const nonEmptyString = (field) => zod_1.z.string().trim().min(1, `${field} must not be empty.`);
exports.externalCompanySchema = zod_1.z.object({
    name: nonEmptyString('company.name'),
    industry: nonEmptyString('company.industry'),
    role: nonEmptyString('company.role'),
    website: zod_1.z.string().url('company.website must be a valid URL.').optional(),
    employees: zod_1.z.number().int().nonnegative().optional(),
});
exports.externalUserSchema = zod_1.z.object({
    id: nonEmptyString('id'),
    name: nonEmptyString('name'),
    email: zod_1.z.string().email('email must be a valid email address.'),
    phone: zod_1.z.string().optional(),
    status: exports.externalUserStatusSchema,
    company: exports.externalCompanySchema,
    createdAt: zod_1.z.string().datetime({
        offset: true,
        message: 'createdAt must be a valid ISO 8601 datetime.',
    }),
    updatedAt: zod_1.z.string().datetime({
        offset: true,
        message: 'updatedAt must be a valid ISO 8601 datetime.',
    }),
});
exports.externalPaginationSchema = zod_1.z.object({
    page: zod_1.z.number().int().positive(),
    limit: zod_1.z.number().int().positive(),
    total: zod_1.z.number().int().nonnegative(),
    totalPages: zod_1.z.number().int().nonnegative(),
    hasNextPage: zod_1.z.boolean(),
    hasPrevPage: zod_1.z.boolean(),
});
exports.externalUserListResponseSchema = zod_1.z
    .object({
    data: zod_1.z.array(exports.externalUserSchema),
    pagination: exports.externalPaginationSchema,
})
    .refine((response) => {
    const ids = response.data.map((user) => user.id);
    return new Set(ids).size === ids.length;
}, { message: 'Response contains duplicate user ids within one page.' });
//# sourceMappingURL=customer-api.schema.js.map
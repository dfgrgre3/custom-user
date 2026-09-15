import { z } from 'zod';
export declare const externalUserStatusSchema: z.ZodEnum<{
    active: "active";
    invited: "invited";
    suspended: "suspended";
}>;
export declare const externalCompanySchema: z.ZodObject<{
    name: z.ZodString;
    industry: z.ZodString;
    role: z.ZodString;
    website: z.ZodOptional<z.ZodString>;
    employees: z.ZodOptional<z.ZodNumber>;
}, z.core.$strip>;
export declare const externalUserSchema: z.ZodObject<{
    id: z.ZodString;
    name: z.ZodString;
    email: z.ZodString;
    phone: z.ZodOptional<z.ZodString>;
    status: z.ZodEnum<{
        active: "active";
        invited: "invited";
        suspended: "suspended";
    }>;
    company: z.ZodObject<{
        name: z.ZodString;
        industry: z.ZodString;
        role: z.ZodString;
        website: z.ZodOptional<z.ZodString>;
        employees: z.ZodOptional<z.ZodNumber>;
    }, z.core.$strip>;
    createdAt: z.ZodString;
    updatedAt: z.ZodString;
}, z.core.$strip>;
export declare const externalPaginationSchema: z.ZodObject<{
    page: z.ZodNumber;
    limit: z.ZodNumber;
    total: z.ZodNumber;
    totalPages: z.ZodNumber;
    hasNextPage: z.ZodBoolean;
    hasPrevPage: z.ZodBoolean;
}, z.core.$strip>;
export declare const externalUserListResponseSchema: z.ZodObject<{
    data: z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        name: z.ZodString;
        email: z.ZodString;
        phone: z.ZodOptional<z.ZodString>;
        status: z.ZodEnum<{
            active: "active";
            invited: "invited";
            suspended: "suspended";
        }>;
        company: z.ZodObject<{
            name: z.ZodString;
            industry: z.ZodString;
            role: z.ZodString;
            website: z.ZodOptional<z.ZodString>;
            employees: z.ZodOptional<z.ZodNumber>;
        }, z.core.$strip>;
        createdAt: z.ZodString;
        updatedAt: z.ZodString;
    }, z.core.$strip>>;
    pagination: z.ZodObject<{
        page: z.ZodNumber;
        limit: z.ZodNumber;
        total: z.ZodNumber;
        totalPages: z.ZodNumber;
        hasNextPage: z.ZodBoolean;
        hasPrevPage: z.ZodBoolean;
    }, z.core.$strip>;
}, z.core.$strip>;

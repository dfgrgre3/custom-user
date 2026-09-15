declare const _default: (() => {
    environment: string;
    port: number;
    supabase: {
        url: string;
        serviceRoleKey: string;
    };
    frontendOrigin: string | undefined;
    customer: {
        name: string;
        apiBaseUrl: string;
        apiToken: string;
        timeoutMs: number;
        maxRetries: number;
        pageSize: number;
    };
    syncCron: string;
}) & import("@nestjs/config").ConfigFactoryKeyHost<{
    environment: string;
    port: number;
    supabase: {
        url: string;
        serviceRoleKey: string;
    };
    frontendOrigin: string | undefined;
    customer: {
        name: string;
        apiBaseUrl: string;
        apiToken: string;
        timeoutMs: number;
        maxRetries: number;
        pageSize: number;
    };
    syncCron: string;
}>;
export default _default;

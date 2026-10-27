import { ADMIN_EMAIL } from './identity';

export interface LoginCredentials {
    email: string;
    password: string;
    invalidPassword: string;
}

export interface LoginTestConfig {
    successUrlPattern: string;
}

function requireEnv(name: string): string {
    const value = process.env[name];
    if (!value) {
        throw new Error(`Missing required environment variable: ${name}`);
    }

    return value;
}

/**
 * The administrator every test signs in as. They are created by the tenant owner in setup
 * (tests/setup/01a-admin-user.spec.ts), so the tenant's own login is only used to get that far.
 */
export function getLoginCredentials(): LoginCredentials {
    const email = process.env.TEST_ADMIN_EMAIL || ADMIN_EMAIL;
    const password = requireEnv('TEST_ADMIN_PASSWORD');
    const invalidPassword = process.env.INVALID_TEST_USER_PASSWORD || `${password}-invalid`;

    return {
        email,
        password,
        invalidPassword,
    };
}

/** The tenant owner (TEST_USER_*): signs in to create the administrator, then is left alone. */
export function getTenantCredentials(): LoginCredentials {
    const email = requireEnv('TEST_USER_EMAIL');
    const password = requireEnv('TEST_USER_PASSWORD');
    const invalidPassword = process.env.INVALID_TEST_USER_PASSWORD || `${password}-invalid`;

    return {
        email,
        password,
        invalidPassword,
    };
}

export function getLoginTestConfig(): LoginTestConfig {
    return {
        successUrlPattern: process.env.LOGIN_SUCCESS_PATTERN || '(dashboard|home)',
    };
}

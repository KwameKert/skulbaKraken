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

export function getLoginCredentials(): LoginCredentials {
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

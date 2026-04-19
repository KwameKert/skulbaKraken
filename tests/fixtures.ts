import { expect, test as base } from '@playwright/test';
import { getLoginCredentials, getLoginTestConfig } from './data/credentials';
import { LoginPage } from './pages/LoginPage';

type TestFixtures = {
    truncateSchema: () => Promise<void>;
};

export const test = base.extend<TestFixtures>({
    truncateSchema: async ({ request }, use) => {
        const truncateSchema = async (): Promise<void> => {
            const backendUrl = process.env.BACKEND_URL;
            const resetSecret = process.env.TEST_RESET_SECRET;

            if (!backendUrl) {
                throw new Error('Missing BACKEND_URL environment variable required for truncateSchema().');
            }

            if (!resetSecret) {
                throw new Error('Missing TEST_RESET_SECRET environment variable required for truncateSchema().');
            }

            const response = await request.post(`${backendUrl}/users/test/reset`, {
                headers: { 'X-Reset-Secret': resetSecret },
            });

            if (!response.ok()) {
                throw new Error(`truncateSchema() failed with status ${response.status()} ${response.statusText()}.`);
            }
        };

        await use(truncateSchema);
    },
    page: async ({ page }, use, testInfo) => {
        if (process.env.DEBUG_BROWSER_LOGS) {
            const worker = process.env.PLAYWRIGHT_WORKER_INDEX ?? '0';
            const title = testInfo.title;

            page.on('console', (msg) => {
                console.log(`[worker:${worker}] [${title}] [browser:${msg.type()}] ${msg.text()}`);
            });

            page.on('pageerror', (error) => {
                console.error(`[worker:${worker}] [${title}] [pageerror] ${error.message}`);
            });

            page.on('requestfailed', (request) => {
                const failure = request.failure();
                console.error(
                    `[worker:${worker}] [${title}] [requestfailed] ${request.method()} ${request.url()} :: ${failure?.errorText ?? 'unknown error'}`,
                );
            });
        }

        await use(page);
    },
});

export const authenticatedTest = test.extend({
    page: async ({ page }, use) => {
        const credentials = getLoginCredentials();
        const config = getLoginTestConfig();
        const loginPage = new LoginPage(page);

        await loginPage.visit();
        await loginPage.login(credentials.email, credentials.password);
        await expect(page).toHaveURL(new RegExp(config.successUrlPattern, 'i'));

        await use(page);
    },
});

export { expect };

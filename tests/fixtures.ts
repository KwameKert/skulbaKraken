import { expect, test as base } from '@playwright/test';

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

            // The reset deletes every employee's Keycloak user one by one before truncating, so it grows with
            // the data the tests have created. Give it room instead of the default 30 seconds.
            const response = await request.post(`${backendUrl}/users/test/reset`, {
                headers: { 'X-Reset-Secret': resetSecret },
                timeout: 600_000,
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

/**
 * Tests that need a logged-in admin. The session comes from the project's `storageState`
 * (saved once by tests/auth.setup.ts), so there is no login form here.
 */
export const authenticatedTest = test.extend({
    page: async ({ page }, use) => {
        // The app shows a "New: Global Search" tip card to fresh browser profiles. It floats over
        // the page and can intercept clicks, so mark it dismissed before the app boots.
        await page.addInitScript(() => {
            try {
                localStorage.setItem('searchTipDismissed', '1');
            } catch {
                // storage unavailable (e.g. opaque origin): nothing to dismiss
            }
        });

        await use(page);
    },
});

/** Opt a test or describe block out of the saved admin session: `test.use(loggedOut)`. */
export const loggedOut = { storageState: { cookies: [], origins: [] } };

export { expect };

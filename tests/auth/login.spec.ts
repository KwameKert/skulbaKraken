import { expect, test } from '../fixtures';
import { getLoginCredentials, getLoginTestConfig } from '../data/credentials';
import { LoginPage } from '../pages/LoginPage';

test.describe('Login', () => {
    test.beforeAll(async ({ truncateSchema }) => {
        await truncateSchema();
    });
    test('logs in with valid credentials', async ({ page }) => {
        const credentials = getLoginCredentials();
        const config = getLoginTestConfig();
        const loginPage = new LoginPage(page);

        await loginPage.visit();
        await loginPage.login(credentials.email, credentials.password);

        await expect(page).toHaveURL(new RegExp(config.successUrlPattern, 'i'));
    });

    test('shows an error with invalid credentials', async ({ page }) => {
        const credentials = getLoginCredentials();
        const loginPage = new LoginPage(page);

        await loginPage.visit();
        await loginPage.login(credentials.email, credentials.invalidPassword);

        await expect(page).toHaveURL(/login|auth|sign[ -]?in/i);
        await expect
            .poll(async () => loginPage.hasVisibleLoginError(), {
                message: 'Expected a visible login error after submitting invalid credentials.',
            })
            .toBeTruthy();
    });
});

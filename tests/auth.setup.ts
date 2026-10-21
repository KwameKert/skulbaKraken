import path from 'path';
import { expect, test as setup } from './fixtures';
import { getLoginCredentials, getLoginTestConfig } from './data/credentials';
import { LoginPage } from './pages/LoginPage';

/**
 * Logs in once through Keycloak and saves the browser session. Every other project starts from
 * this file (see `storageState` in playwright.config.ts), so tests no longer repeat the login form.
 */
export const AUTH_FILE = path.join(__dirname, '..', 'playwright', '.auth', 'admin.json');

setup('authenticate as the admin user', async ({ page }) => {
    const credentials = getLoginCredentials();
    const config = getLoginTestConfig();
    const loginPage = new LoginPage(page);

    await loginPage.visit();
    await loginPage.login(credentials.email, credentials.password);
    await expect(page).toHaveURL(new RegExp(config.successUrlPattern, 'i'));

    await page.context().storageState({ path: AUTH_FILE });
});

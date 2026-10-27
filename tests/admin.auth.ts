import { expect, test as setup } from './fixtures';
import { AUTH_FILE } from './data/auth-files';
import { getLoginCredentials, getLoginTestConfig } from './data/credentials';
import { LoginPage } from './pages/LoginPage';

/**
 * Logs in once as the test administrator and saves the browser session. Every project except `auth`
 * and `setup` starts from it (see `storageState` in playwright.config.ts), so tests no longer repeat
 * the login form. The administrator already exists: setup creates it, and a normal run keeps it.
 */
setup('authenticate as the admin user', async ({ page }) => {
    const credentials = getLoginCredentials();
    const config = getLoginTestConfig();
    const loginPage = new LoginPage(page);

    await loginPage.visit();
    await loginPage.login(credentials.email, credentials.password);
    await expect(page).toHaveURL(new RegExp(config.successUrlPattern, 'i'));

    await page.context().storageState({ path: AUTH_FILE });
});

import { expect, test as setup } from './fixtures';
import { TENANT_AUTH_FILE } from './data/auth-files';
import { getLoginTestConfig, getTenantCredentials } from './data/credentials';
import { LoginPage } from './pages/LoginPage';

/**
 * Logs in once as the tenant owner and saves the browser session. Only the setup project uses it:
 * the tenant creates the administrator (tests/setup/01a-admin-user.spec.ts) and every test after
 * that signs in as that administrator (tests/admin.auth.ts).
 */
setup('authenticate as the tenant owner', async ({ page }) => {
    const credentials = getTenantCredentials();
    const config = getLoginTestConfig();
    const loginPage = new LoginPage(page);

    await loginPage.visit();
    await loginPage.login(credentials.email, credentials.password);
    await expect(page).toHaveURL(new RegExp(config.successUrlPattern, 'i'));

    await page.context().storageState({ path: TENANT_AUTH_FILE });
});

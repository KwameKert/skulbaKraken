import { authenticatedTest as test, expect } from '../fixtures';
import { getLoginCredentials } from '../data/credentials';
import { makeStaff } from '../data/people';
import { signIn, TEMP_PASSWORD } from '../helpers/session';
import { AUTH_FILE, TENANT_AUTH_FILE } from '../data/auth-files';
import { StaffPage } from '../pages/StaffPage';

/**
 * The tenant owner makes the administrator every other test signs in as, and that administrator does
 * what any new staff member does: sign in with the temporary password and choose their own.
 * This is the only file that runs as the tenant; it comes straight after the truncate, which removes
 * the previous administrator along with every other employee.
 */
test.describe('Test administrator', () => {
    test.use({ storageState: TENANT_AUTH_FILE });

    test('the tenant owner creates the administrator, who sets their own password', async ({ page, browser }) => {
        test.setTimeout(180_000);
        const { email, password } = getLoginCredentials();
        const admin = makeStaff({
            employeeType: 'Admin',
            firstName: 'Admin',
            lastName: 'Kraken',
            gender: 'Male',
            email,
            notes: 'E2E test administrator',
        });

        const staffPage = new StaffPage(page);
        await staffPage.visitAddForm();
        await staffPage.fillStaffForm(admin);
        const [response] = await Promise.all([
            page.waitForResponse(r => r.url().includes('/employees') && r.request().method() === 'POST'),
            staffPage.submitForm(),
        ]);
        expect(response.ok(), `create admin: status ${response.status()} ${await response.text()}`).toBeTruthy();

        // The truncate empties the database, not Keycloak. On a shared server the administrator's login
        // outlives it, so the first sign-in may not ask for a new password: then the existing one is used.
        let session = await signIn(browser, email, TEMP_PASSWORD);
        const prompted = await session.page.locator('#password-new').waitFor({ timeout: 15_000 }).then(() => true, () => false);
        if (prompted) {
            await session.login.completeRequiredPasswordUpdate(password);
        } else if (password !== TEMP_PASSWORD) {
            await session.close();
            session = await signIn(browser, email, password);
        }
        await session.page.waitForURL(/\/dashboard/);
        await session.page.context().storageState({ path: AUTH_FILE });
        await session.close();
    });
});

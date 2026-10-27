import { Browser, Page } from '@playwright/test';
import { authenticatedTest as test, expect, loggedOut } from '../fixtures';
import { StaffPage } from '../pages/StaffPage';
import { LoginPage } from '../pages/LoginPage';
import { makeStaff } from '../data/people';

/**
 * Can a staff member created in the portal actually get in, and are they locked out again once
 * deleted? Creating staff provisions a Keycloak user with a temporary password ("password"):
 * the first login forces a password change. These flows use a clean browser context each time,
 * separate from the admin session.
 */
const TEMP_PASSWORD = 'password';
const NEW_PASSWORD = 'Newpass#12345';
const AFTER_RESET_PASSWORD = 'Afterreset#12345';
// the password the staff member currently has; the Reset Password test changes it
let currentPassword = NEW_PASSWORD;

const staff = makeStaff({ employeeType: 'Teacher' });
const fullName = `${staff.firstName} ${staff.lastName}`;

const isEmployeeWrite = (method: string) => (res: { url(): string; request(): { method(): string } }) =>
    res.url().includes('/employees') && res.request().method() === method;

async function freshLogin(browser: Browser, email: string, password: string): Promise<{ page: Page; login: LoginPage; close: () => Promise<void> }> {
    const context = await browser.newContext(loggedOut);
    const page = await context.newPage();
    const login = new LoginPage(page);
    await login.visit();
    await login.login(email, password);
    return { page, login, close: () => context.close() };
}

test.describe.serial('Staff — sign-in access', () => {
    test('creating a staff member provisions a login', async ({ page }) => {
        const staffPage = new StaffPage(page);
        await staffPage.visitAddForm();
        await staffPage.fillStaffForm(staff);

        const [response] = await Promise.all([page.waitForResponse(isEmployeeWrite('POST')), staffPage.submitForm()]);
        expect(response.ok(), `status ${response.status()}`).toBeTruthy();
        await expect(page).toHaveURL(/staff-details\/\d+/i);
    });

    test('first login with the temporary password forces a password change and lands on the dashboard', async ({ browser }) => {
        const { page, login, close } = await freshLogin(browser, staff.email, TEMP_PASSWORD);

        await login.expectPasswordUpdateRequired();
        await login.completeRequiredPasswordUpdate(NEW_PASSWORD);

        await expect(page).toHaveURL(/\/dashboard/);
        await expect(page.getByText(new RegExp(`Welcome Back, ${staff.firstName}`))).toBeVisible();
        await close();
    });

    test('the temporary password stops working once it has been changed', async ({ browser }) => {
        const { login, close } = await freshLogin(browser, staff.email, TEMP_PASSWORD);

        await login.expectInvalidCredentials();
        await close();
    });

    test('the new password signs in without asking for another change', async ({ browser }) => {
        const { page, close } = await freshLogin(browser, staff.email, NEW_PASSWORD);

        await expect(page).toHaveURL(/\/dashboard/);
        await expect(page.getByText(new RegExp(`Welcome Back, ${staff.firstName}`))).toBeVisible();
        await close();
    });

    test('Reset Password sets the temporary password again', async ({ page, browser }) => {
        const staffPage = new StaffPage(page);
        await staffPage.visit();
        await staffPage.search(staff.lastName);
        await expect(staffPage.rowByName(fullName)).toBeVisible();
        await staffPage.clickResetPasswordInRow(fullName);
        const [response] = await Promise.all([
            page.waitForResponse(res => /reset/i.test(res.url()) && res.request().method() !== 'GET'),
            staffPage.confirmSwal(),
        ]);
        expect(response.ok(), `status ${response.status()}: ${await response.text()}`).toBeTruthy();

        const old = await freshLogin(browser, staff.email, NEW_PASSWORD);
        await old.login.expectInvalidCredentials();
        await old.close();

        const reset = await freshLogin(browser, staff.email, TEMP_PASSWORD);
        await reset.login.expectPasswordUpdateRequired();
        await reset.login.completeRequiredPasswordUpdate(AFTER_RESET_PASSWORD);
        await expect(reset.page).toHaveURL(/\/dashboard/);
        await reset.close();
        currentPassword = AFTER_RESET_PASSWORD;
    });

    test('a role change is reflected at the next login', async ({ page, browser }) => {
        const staffPage = new StaffPage(page);
        await staffPage.visit();
        await staffPage.search(staff.lastName);
        await expect(staffPage.rowByName(fullName)).toBeVisible();
        await staffPage.clickEditInRow(fullName);
        await expect(page.locator('#app-add-employee-last-name')).toHaveValue(staff.lastName);

        await page.locator('#app-add-employee-employee-type').click();
        await page.locator('.p-dropdown-item').filter({ hasText: 'Accountant' }).first().click();
        const [response] = await Promise.all([page.waitForResponse(isEmployeeWrite('PATCH')), staffPage.submitForm()]);
        expect(response.ok()).toBeTruthy();

        const login = await freshLogin(browser, staff.email, currentPassword);
        await expect(login.page).toHaveURL(/\/dashboard/);
        await expect(login.page).not.toHaveURL(/teacher-dashboard/);
        await login.close();
    });

    test('deleting the staff member locks them out', async ({ page, browser }) => {
        const staffPage = new StaffPage(page);
        await staffPage.visit();
        await staffPage.search(staff.lastName);
        await expect(staffPage.rowByName(fullName)).toBeVisible();
        await staffPage.clickDeleteInRow(fullName);
        const [response] = await Promise.all([page.waitForResponse(isEmployeeWrite('DELETE')), staffPage.confirmSwal()]);
        expect(response.ok()).toBeTruthy();

        const login = await freshLogin(browser, staff.email, currentPassword);
        await login.login.expectInvalidCredentials();
        await login.close();
    });

    test('a re-hired staff member can log in again and must set a new password', async ({ page, browser }) => {
        const staffPage = new StaffPage(page);
        await staffPage.visitAddForm();
        await staffPage.fillStaffForm(makeStaff({ email: staff.email, employeeType: 'Teacher' }));
        const [response] = await Promise.all([page.waitForResponse(isEmployeeWrite('POST')), staffPage.submitForm()]);
        expect(response.ok(), `status ${response.status()}`).toBeTruthy();

        const login = await freshLogin(browser, staff.email, TEMP_PASSWORD);
        await login.login.expectPasswordUpdateRequired();
        await login.login.completeRequiredPasswordUpdate('Another#Pass1234');
        await expect(login.page).toHaveURL(/\/dashboard/);
        await login.close();
    });
});

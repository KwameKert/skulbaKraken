import { authenticatedTest as test, expect, test as baseTest, loggedOut } from '../fixtures';
import { StaffPage } from '../pages/StaffPage';
import { makeStaff } from '../data/people';

// One staff member is created, then edited, then deleted by later tests.
const staff = makeStaff({ employeeType: 'Accountant', languages: ['English', 'Twi'] });
const duplicateEmailStaff = makeStaff({ email: staff.email });
const fullName = `${staff.firstName} ${staff.lastName}`;

const isEmployeeWrite = (method: string) => (res: { url(): string; request(): { method(): string } }) =>
    res.url().includes('/employees') && res.request().method() === method;

test.describe.serial('Staff', () => {
    test.describe('List view', () => {
        test('loads the staff list with expected columns', async ({ page }) => {
            const staffPage = new StaffPage(page);
            await staffPage.visit();

            await staffPage.expectColumnHeaders(['ID', 'Name', 'Email', 'Type', 'Gender', 'Contact', 'Status', 'Action']);
        });

        test('Add Staff button navigates to the create form', async ({ page }) => {
            const staffPage = new StaffPage(page);
            await staffPage.visit();

            await staffPage.clickAddStaff();

            await expect(page).toHaveURL(/add-staff/i);
        });
    });

    test.describe('Create form — validation', () => {
        test('shows a disabled submit button when the form is empty', async ({ page }) => {
            const staffPage = new StaffPage(page);
            await staffPage.visitAddForm();

            await expect(page.getByRole('heading', { name: /add staff/i })).toBeVisible();
            expect(await staffPage.isSubmitDisabled()).toBeTruthy();
        });

        test('shows required errors for First Name and Last Name', async ({ page }) => {
            const staffPage = new StaffPage(page);
            await staffPage.visitAddForm();

            await staffPage.touchField('first-name');
            await staffPage.touchField('last-name');

            await staffPage.expectFieldError(/first name is required/i);
            await staffPage.expectFieldError(/last name is required/i);
        });

        test('shows an error when the phone number is not numeric', async ({ page }) => {
            const staffPage = new StaffPage(page);
            await staffPage.visitAddForm();

            await staffPage.fillById('primary-contact-number', 'abc');
            await staffPage.touchField('primary-contact-number');

            await staffPage.expectFieldError(/phone must be numeric/i);
        });

        test('shows an error for a malformed email', async ({ page }) => {
            const staffPage = new StaffPage(page);
            await staffPage.visitAddForm();

            await staffPage.fillById('email', 'not-an-email');
            await staffPage.touchField('email');

            await staffPage.expectFieldError(/invalid email/i);
        });

        test('shows a required error for the emergency contact name', async ({ page }) => {
            const staffPage = new StaffPage(page);
            await staffPage.visitAddForm();

            await staffPage.touchField('emergency-contact-name');

            await staffPage.expectFieldError(/field is required/i);
        });
    });

    test.describe('Create staff', () => {
        test('creates a staff member and opens the staff details page', async ({ page }) => {
            const staffPage = new StaffPage(page);
            await staffPage.visitAddForm();

            await staffPage.fillStaffForm(staff);
            expect(await staffPage.isSubmitDisabled()).toBeFalsy();

            const [response] = await Promise.all([
                page.waitForResponse(isEmployeeWrite('POST')),
                staffPage.submitForm(),
            ]);

            expect(response.ok()).toBeTruthy();
            await expect(page).toHaveURL(/staff-details\/\d+/i);
        });

        test('the new staff member appears in the list with the chosen role', async ({ page }) => {
            const staffPage = new StaffPage(page);
            await staffPage.visit();

            await staffPage.search(staff.lastName);

            const row = staffPage.rowByName(fullName);
            await expect(row).toBeVisible();
            await expect(row).toContainText(staff.email);
            await expect(row).toContainText(/accountant/i);
        });

        test('search with an unknown term shows no matching row', async ({ page }) => {
            const staffPage = new StaffPage(page);
            await staffPage.visit();

            await staffPage.search('zz-no-such-staff-zz');

            await expect(staffPage.rowByName(staff.lastName)).toHaveCount(0);
        });

        test('a duplicate email is rejected and the form stays open', async ({ page }) => {
            const staffPage = new StaffPage(page);
            await staffPage.visitAddForm();
            await staffPage.fillStaffForm(duplicateEmailStaff);

            const [response] = await Promise.all([
                page.waitForResponse(isEmployeeWrite('POST')),
                staffPage.submitForm(),
            ]);

            expect(response.ok()).toBeFalsy();
            await expect(page.locator('.p-toast-message-error')).toBeVisible();
            await expect(page).toHaveURL(/add-staff/i);
        });

        test('a duplicate email of an active staff member returns a client error, not a 500', async ({ page }) => {
            const staffPage = new StaffPage(page);
            await staffPage.visitAddForm();
            await staffPage.fillStaffForm(makeStaff({ email: staff.email }));

            const [response] = await Promise.all([
                page.waitForResponse(isEmployeeWrite('POST')),
                staffPage.submitForm(),
            ]);

            expect(response.status()).toBeGreaterThanOrEqual(400);
            expect(response.status()).toBeLessThan(500);
        });
    });

    test.describe('Edit staff', () => {
        test('Edit opens the form with the saved data and a locked email', async ({ page }) => {
            const staffPage = new StaffPage(page);
            await staffPage.visit();
            await staffPage.search(staff.lastName);
            await expect(staffPage.rowByName(fullName)).toBeVisible();

            await staffPage.clickEditInRow(fullName);

            await expect(page).toHaveURL(/edit-staff\/\d+/i);
            await expect(page.locator('#app-add-employee-first-name')).toHaveValue(staff.firstName);
            await expect(page.locator('#app-add-employee-last-name')).toHaveValue(staff.lastName);
            await expect(page.locator('#app-add-employee-email')).toBeDisabled();
            await expect(page.locator('#app-add-employee-submit-button')).toHaveText(/update staff/i);
        });

        test('saves a role change', async ({ page }) => {
            const staffPage = new StaffPage(page);
            await staffPage.visit();
            await staffPage.search(staff.lastName);
            await expect(staffPage.rowByName(fullName)).toBeVisible();
            await staffPage.clickEditInRow(fullName);
            await expect(page.locator('#app-add-employee-last-name')).toHaveValue(staff.lastName);

            await page.locator('#app-add-employee-employee-type').click();
            await page.locator('.p-dropdown-item').filter({ hasText: /^\s*Admin\s*$/ }).click();
            const [response] = await Promise.all([
                page.waitForResponse(isEmployeeWrite('PATCH')),
                staffPage.submitForm(),
            ]);

            expect(response.ok()).toBeTruthy();
            await expect(page).toHaveURL(/staff-details\/\d+/i);
        });

        test('edit form heading says "Edit Staff"', async ({ page }) => {

            const staffPage = new StaffPage(page);
            await staffPage.visit();
            await staffPage.search(staff.lastName);
            await expect(staffPage.rowByName(fullName)).toBeVisible();
            await staffPage.clickEditInRow(fullName);

            await expect(page.getByRole('heading', { name: /edit staff/i })).toBeVisible();
        });

        test('Cancel leaves the add form', async ({ page }) => {
            const staffPage = new StaffPage(page);
            await staffPage.visitAddForm();

            await staffPage.cancelForm();

            await expect(page).not.toHaveURL(/add-staff/i);
        });
    });

    test.describe('Row actions', () => {
        test('Reset Password asks for confirmation and can be cancelled', async ({ page }) => {
            const staffPage = new StaffPage(page);
            await staffPage.visit();
            await staffPage.search(staff.lastName);
            await expect(staffPage.rowByName(fullName)).toBeVisible();

            await staffPage.clickResetPasswordInRow(fullName);
            await expect(page.locator('.swal2-popup')).toContainText(/reset password/i);
            await staffPage.cancelSwal();

            await expect(staffPage.rowByName(fullName)).toBeVisible();
        });
    });

    test.describe('Delete staff', () => {
        test('cancelling the confirmation keeps the row', async ({ page }) => {
            const staffPage = new StaffPage(page);
            await staffPage.visit();
            await staffPage.search(staff.lastName);
            await expect(staffPage.rowByName(fullName)).toBeVisible();

            await staffPage.clickDeleteInRow(fullName);
            await expect(page.locator('.swal2-popup')).toBeVisible();
            await staffPage.cancelSwal();

            await expect(staffPage.rowByName(fullName)).toBeVisible();
        });

        test('confirming delete removes the row and shows a success toast', async ({ page }) => {
            const staffPage = new StaffPage(page);
            await staffPage.visit();
            await staffPage.search(staff.lastName);
            await expect(staffPage.rowByName(fullName)).toBeVisible();

            await staffPage.clickDeleteInRow(fullName);
            const [response] = await Promise.all([
                page.waitForResponse(isEmployeeWrite('DELETE')),
                staffPage.confirmSwal(),
            ]);

            expect(response.ok()).toBeTruthy();
            await staffPage.expectToastMessage(/staff deleted successfully/i);
            await expect(staffPage.rowByName(fullName)).toHaveCount(0);
        });
    });
});

baseTest.describe('Staff — navigation guard', () => {
    baseTest.use(loggedOut);

    baseTest('redirects unauthenticated users to the login page', async ({ page }) => {
        await page.goto('/peoples/staff/staff-list');

        await expect(page).toHaveURL(/keycloak|openid-connect|auth/i);
    });
});

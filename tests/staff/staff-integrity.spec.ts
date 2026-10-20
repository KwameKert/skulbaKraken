import { Page } from '@playwright/test';
import { authenticatedTest as test, expect } from '../fixtures';
import { StaffPage } from '../pages/StaffPage';
import { makeStaff } from '../data/people';

/**
 * Data-integrity flows for staff: what was saved is what comes back after a reload, edits
 * persist, and a deleted staff member disappears everywhere (and their email can be reused).
 */
const staff = makeStaff({ employeeType: 'Teacher', languages: ['English', 'Twi'] });
const rehire = makeStaff({ email: staff.email, employeeType: 'Accountant' });
const fullName = `${staff.firstName} ${staff.lastName}`;

let staffPath = '';

const isEmployeeWrite = (method: string) => (res: { url(): string; request(): { method(): string } }) =>
    res.url().includes('/employees') && res.request().method() === method;

async function openSavedStaff(page: Page): Promise<void> {
    await page.goto(staffPath);
    await page.reload();
}

test.describe.serial('Staff — data integrity', () => {
    test('creates a staff member', async ({ page }) => {
        const staffPage = new StaffPage(page);
        await staffPage.visitAddForm();
        await staffPage.fillStaffForm(staff);

        const [response] = await Promise.all([
            page.waitForResponse(isEmployeeWrite('POST')),
            staffPage.submitForm(),
        ]);
        expect(response.ok(), `status ${response.status()}: ${await response.text()}`).toBeTruthy();

        await expect(page).toHaveURL(/staff-details\/\d+/i);
        staffPath = new URL(page.url()).pathname;
    });

    test('details page shows every saved field after a reload', async ({ page }) => {
        await openSavedStaff(page);

        await expect(page.getByRole('heading', { name: new RegExp(staff.lastName) })).toBeVisible();
        await expect(page.getByText(/^\s*ACTIVE\s*$/).first()).toBeVisible();
        await expect(page.getByText(/^\s*teacher\s*$/i)).toBeVisible();
        await expect(page.getByText(staff.primaryContactNumber)).toBeVisible();
        await expect(page.getByText(staff.email)).toBeVisible();
        await expect(page.getByText('22 Mar 1990')).toBeVisible();
        await expect(page.getByText(/^\s*single\s*$/i)).toBeVisible();
        await expect(page.getByText(staff.emergencyContactName)).toBeVisible();
        await expect(page.getByText(staff.emergencyContactNumber)).toBeVisible();
        await expect(page.getByText(/^\s*female\s*$/i)).toBeVisible();
        await expect(page.getByText(staff.address!)).toBeVisible();
        await expect(page.getByText('English')).toBeVisible();
        await expect(page.getByText('Twi')).toBeVisible();
    });

    test('the employee code is generated', async ({ page }) => {
        await openSavedStaff(page);

        await expect(page.locator('p.text-primary').first()).toHaveText(/\S+/);
    });

    test('edit form is pre-filled with the saved values', async ({ page }) => {
        const staffPage = new StaffPage(page);
        await staffPage.visitEditForm(staffPath.split('/').pop()!);

        await expect(page.locator('#app-add-employee-employee-type')).toContainText('Teacher');
        await expect(page.locator('#app-add-employee-first-name')).toHaveValue(staff.firstName);
        await expect(page.locator('#app-add-employee-last-name')).toHaveValue(staff.lastName);
        await expect(page.locator('#app-add-employee-primary-contact-number')).toHaveValue(staff.primaryContactNumber);
        await expect(page.locator('#app-add-employee-email')).toHaveValue(staff.email);
        await expect(page.locator('#app-add-employee-date-of-joining')).toHaveValue(staff.dateOfJoining);
        await expect(page.locator('#app-add-employee-date-of-birth')).toHaveValue(staff.dateOfBirth);
        await expect(page.locator('#app-add-employee-emergency-contact-name')).toHaveValue(staff.emergencyContactName);
        await expect(page.locator('#app-add-employee-emergency-contact-number')).toHaveValue(staff.emergencyContactNumber);
        await expect(page.locator('#app-add-employee-address')).toHaveValue(staff.address!);
        await expect(page.locator('#app-add-employee-notes')).toHaveValue(staff.notes!);
    });

    test('edits to phone, address and role persist after a reload', async ({ page }) => {
        const staffPage = new StaffPage(page);
        await staffPage.visitEditForm(staffPath.split('/').pop()!);
        await expect(page.locator('#app-add-employee-last-name')).toHaveValue(staff.lastName);

        const newPhone = makeStaff().primaryContactNumber;
        await staffPage.fillById('primary-contact-number', newPhone);
        await staffPage.fillById('address', '99 Updated Avenue, Tema');
        await page.locator('#app-add-employee-employee-type').click();
        await page.locator('.p-dropdown-item').filter({ hasText: 'Admin' }).first().click();

        const [response] = await Promise.all([
            page.waitForResponse(isEmployeeWrite('PATCH')),
            staffPage.submitForm(),
        ]);
        expect(response.ok()).toBeTruthy();
        await expect(page).toHaveURL(/staff-details\/\d+/i);

        await openSavedStaff(page);
        await expect(page.getByText(newPhone)).toBeVisible();
        await expect(page.getByText('99 Updated Avenue, Tema')).toBeVisible();
        await expect(page.getByText(/^\s*admin\s*$/i)).toBeVisible();
    });

    test('deleting the staff member removes them from the list and search', async ({ page }) => {
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

        await staffPage.visit();
        await staffPage.search(staff.lastName);
        await expect(staffPage.rowByName(fullName)).toHaveCount(0);
    });

    test('opening a deleted staff member by URL does not show them', async ({ page }) => {
        await page.goto(staffPath);
        await page.waitForLoadState('networkidle');

        await expect(page.getByRole('heading', { name: new RegExp(staff.lastName) })).toHaveCount(0);
    });

    test('a deleted staff member\'s email can be used again for a new hire', async ({ page }) => {
        const staffPage = new StaffPage(page);
        await staffPage.visitAddForm();
        await staffPage.fillStaffForm(rehire);

        const [response] = await Promise.all([
            page.waitForResponse(isEmployeeWrite('POST')),
            staffPage.submitForm(),
        ]);

        expect(response.ok(), `status ${response.status()}: ${await response.text()}`).toBeTruthy();
        await expect(page).toHaveURL(/staff-details\/\d+/i);

        // the re-hire carries the new data, not the old record's
        await page.reload();
        await expect(page.getByRole('heading', { name: new RegExp(rehire.lastName) })).toBeVisible();
        await expect(page.getByText(/^\s*accountant\s*$/i)).toBeVisible();
        await expect(page.getByText(rehire.primaryContactNumber)).toBeVisible();
        await expect(page.getByText(/^\s*ACTIVE\s*$/).first()).toBeVisible();
    });
});

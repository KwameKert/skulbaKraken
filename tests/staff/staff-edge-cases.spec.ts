import { authenticatedTest as test, expect } from '../fixtures';
import { StaffPage } from '../pages/StaffPage';
import { makeStaff } from '../data/people';

/**
 * Inactive staff and unusual input for staff. Same intent as the student edge cases:
 * status shown correctly, special characters survive, markup is never executed.
 */
const inactiveStaff = makeStaff({ status: 'Inactive' });
const tagForName = makeStaff();
const specialStaff = makeStaff({
    firstName: 'Zoë',
    lastName: `O'Neil-Müller${tagForName.lastName}`,
    address: `<img src=x onerror="window.__xss=1"> 7 "Quote" & Sons Rd`,
    notes: `<script>window.__xss=1</script>`,
});

const isEmployeeWrite = (method: string) => (res: { url(): string; request(): { method(): string } }) =>
    res.url().includes('/employees') && res.request().method() === method;

test.describe.serial('Staff — inactive and unusual data', () => {
    test('an inactive staff member is saved as inactive and shown that way everywhere', async ({ page }) => {
        const staffPage = new StaffPage(page);
        await staffPage.visitAddForm();
        await staffPage.fillStaffForm(inactiveStaff);

        const [response] = await Promise.all([page.waitForResponse(isEmployeeWrite('POST')), staffPage.submitForm()]);
        expect(response.ok(), `status ${response.status()}`).toBeTruthy();
        await expect(page).toHaveURL(/staff-details\/\d+/i);

        await page.reload();
        await expect(page.getByText(/^\s*INACTIVE\s*$/).first()).toBeVisible();

        await staffPage.visit();
        await staffPage.search(inactiveStaff.lastName);
        const row = staffPage.rowByName(`${inactiveStaff.firstName} ${inactiveStaff.lastName}`);
        await expect(row).toBeVisible();
        await expect(row).toContainText(/inactive/i);
    });

    test('the edit form shows the saved Inactive status', async ({ page }) => {
        const staffPage = new StaffPage(page);
        const name = `${inactiveStaff.firstName} ${inactiveStaff.lastName}`;
        await staffPage.visit();
        await staffPage.search(inactiveStaff.lastName);
        await expect(staffPage.rowByName(name)).toBeVisible();
        await staffPage.clickEditInRow(name);

        await expect(page.locator('#app-add-employee-last-name')).toHaveValue(inactiveStaff.lastName);
        await expect(page.locator('#app-add-employee-status')).toContainText('Inactive');
    });

    test('names with accents, apostrophes and markup are stored and shown as plain text', async ({ page }) => {
        const staffPage = new StaffPage(page);
        await staffPage.visitAddForm();
        await staffPage.fillStaffForm(specialStaff);

        const [response] = await Promise.all([page.waitForResponse(isEmployeeWrite('POST')), staffPage.submitForm()]);
        expect(response.ok(), `status ${response.status()}`).toBeTruthy();
        await expect(page).toHaveURL(/staff-details\/\d+/i);

        await page.reload();
        await expect(page.getByRole('heading', { name: new RegExp(`Zoë O'Neil-Müller`) })).toBeVisible();
        await expect(page.getByText(`<img src=x onerror="window.__xss=1"> 7 "Quote" & Sons Rd`)).toBeVisible();
        expect(await page.evaluate(() => (window as unknown as { __xss?: number }).__xss)).toBeUndefined();
    });

    test('markup is not executed in the staff list or the edit form', async ({ page }) => {
        const staffPage = new StaffPage(page);
        const name = `${specialStaff.firstName} ${specialStaff.lastName}`;
        await staffPage.visit();
        await staffPage.search(specialStaff.lastName);
        await expect(staffPage.rowByName(name)).toBeVisible();
        expect(await page.evaluate(() => (window as unknown as { __xss?: number }).__xss)).toBeUndefined();

        await staffPage.clickEditInRow(name);
        await expect(page.locator('#app-add-employee-address')).toHaveValue(specialStaff.address!);
        await expect(page.locator('#app-add-employee-notes')).toHaveValue(specialStaff.notes!);
        expect(await page.evaluate(() => (window as unknown as { __xss?: number }).__xss)).toBeUndefined();
    });

    test('a staff email with different letter casing is rejected as a duplicate', async ({ page }) => {
        const staffPage = new StaffPage(page);
        await staffPage.visitAddForm();
        await staffPage.fillStaffForm(makeStaff({ email: inactiveStaff.email.toUpperCase() }));

        const [response] = await Promise.all([page.waitForResponse(isEmployeeWrite('POST')), staffPage.submitForm()]);

        const body = await response.text();
        expect(response.status(), `status ${response.status()}: ${body.slice(0, 300)}`).toBeGreaterThanOrEqual(400);
        expect(response.status(), `status ${response.status()}: ${body.slice(0, 300)}`).toBeLessThan(500);
    });
});

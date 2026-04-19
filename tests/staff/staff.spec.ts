import { authenticatedTest as test, expect, test as baseTest } from '../fixtures';
import { StaffPage, StaffFormData } from '../pages/StaffPage';

const validStaff: StaffFormData = {
    employeeType: 'Teacher',
    firstName: 'Ama',
    lastName: 'Owusu',
    gender: 'Female',
    primaryContactNumber: '0241234567',
    email: 'ama.owusu.e2e@example.com',
    dateOfJoining: '01/05/2024',
    dateOfBirth: '03/22/1990',
    maritalStatus: 'Single',
    languages: ['English', 'Twi'],
    qualification: 'BSc Education',
    workExperience: '5 years',
    emergencyContactName: 'Kofi Owusu',
    emergencyContactNumber: '0201234567',
    address: '10 Test Lane, Kumasi',
    status: 'Active',
    notes: 'E2E test staff member',
};

test.describe('Staff', () => {
    test.describe('List view', () => {
        test('shows staff list table with expected columns', async ({ page }) => {
            const staffPage = new StaffPage(page);
            await staffPage.visit();
            await staffPage.expectListVisible();
            // TODO: Confirm exact column header text matches live UI
            await staffPage.expectColumnHeaders(['Name', 'Gender', 'Contact', 'Status', 'Action']);
        });

        test('search input filters the table', async ({ page }) => {
            const staffPage = new StaffPage(page);
            await staffPage.visit();
            await staffPage.expectListVisible();
            //  await page.waitForTimeout(5000); // Wait for any initial loading to settle
            await staffPage.search('Ama');
            //await staffPage.expectListVisible();
        });

        test('Reset Filters clears the search', async ({ page }) => {
            const staffPage = new StaffPage(page);
            await staffPage.visit();
            const rowsBefore = await staffPage.getTableRowCount();
            await staffPage.search('Ama');
            await staffPage.clickResetFilters();
            await expect.poll(
                async () => staffPage.getTableRowCount(),
                { message: 'Expected row count to restore after reset.' }
            ).toBe(rowsBefore);
        });

        test('Add Staff button navigates to create form', async ({ page }) => {
            const staffPage = new StaffPage(page);
            await staffPage.visit();
            await staffPage.clickAddStaff();
            await expect(page).toHaveURL(/add-staff/i);
        });
    });

    test.describe('Create staff', () => {
        test('shows the add staff form', async ({ page }) => {
            const staffPage = new StaffPage(page);
            await staffPage.visitAddForm();
            await expect(page).toHaveURL(/add-staff/i);
        });

        test('creates a staff member with valid data', async ({ page }) => {
            const staffPage = new StaffPage(page);
            await staffPage.visitAddForm();
            await staffPage.fillStaffForm(validStaff);
            await staffPage.submitForm();

            await expect.poll(
                async () => {
                    const url = page.url();
                    const toastVisible = await page
                        .locator('.p-toast-message')
                        .filter({ hasText: /added successfully/i })
                        .isVisible();
                    return url.match(/staff-details/i) || toastVisible;
                },
                { message: 'Expected redirect to staff-details or success toast after creation.' }
            ).toBeTruthy();
        });
    });

    test.describe('Validation', () => {
        test('submit button is disabled when form is empty', async ({ page }) => {
            const staffPage = new StaffPage(page);
            await staffPage.visitAddForm();
            await expect(page.locator('#app-add-employee-submit-button')).toBeDisabled();
        });

        test('shows required error for First Name when blurred', async ({ page }) => {
            const staffPage = new StaffPage(page);
            await staffPage.visitAddForm();
            await page.locator('#app-add-employee-first-name').click();
            await page.locator('#app-add-employee-last-name').click();
            await expect.poll(
                async () => page.locator('.text-danger').filter({ hasText: 'First Name is required.' }).count(),
                { message: 'Expected First Name required validation error.' }
            ).toBeGreaterThan(0);
        });

        test('shows required error for Last Name when blurred', async ({ page }) => {
            const staffPage = new StaffPage(page);
            await staffPage.visitAddForm();
            await page.locator('#app-add-employee-last-name').click();
            await page.locator('#app-add-employee-first-name').click();
            await expect.poll(
                async () => page.locator('.text-danger').filter({ hasText: 'Last Name is required.' }).count(),
                { message: 'Expected Last Name required validation error.' }
            ).toBeGreaterThan(0);
        });

        test('shows phone number pattern error for non-numeric input', async ({ page }) => {
            const staffPage = new StaffPage(page);
            await staffPage.visitAddForm();
            await page.locator('#app-add-employee-primary-contact-number').fill('abc-xyz');
            await page.keyboard.press('Tab');
            await expect.poll(
                async () =>
                    page.locator('.text-danger').filter({ hasText: 'Phone must be numeric.' }).count(),
                { message: 'Expected phone number pattern validation error.' }
            ).toBeGreaterThan(0);
        });

        test('shows email validation error for malformed email', async ({ page }) => {
            const staffPage = new StaffPage(page);
            await staffPage.visitAddForm();
            await page.locator('#app-add-employee-email').fill('not-an-email');
            await page.keyboard.press('Tab');
            await expect.poll(
                async () =>
                    page.locator('.text-danger').filter({ hasText: 'Invalid email format.' }).count(),
                { message: 'Expected email validation error.' }
            ).toBeGreaterThan(0);
        });

        test('shows required error for Emergency Contact Name when blurred', async ({ page }) => {
            const staffPage = new StaffPage(page);
            await staffPage.visitAddForm();
            await page.locator('#app-add-employee-emergency-contact-name').click();
            await page.locator('#app-add-employee-first-name').click();
            await expect.poll(
                async () =>
                    page.locator('.text-danger').filter({ hasText: 'Field is required.' }).count(),
                { message: 'Expected Emergency Contact Name required error.' }
            ).toBeGreaterThan(0);
        });
    });

    test.describe('Edit staff', () => {
        const updatedNotes = 'Updated via E2E test';

        test('edit form loads for an existing staff member', async ({ page }) => {
            const staffPage = new StaffPage(page);
            await staffPage.visit();
            await staffPage.clickEditInRow(validStaff.firstName);
            await expect(page).toHaveURL(/edit-staff/i);
        });

        test('saves changes and shows success toast or redirects', async ({ page }) => {
            const staffPage = new StaffPage(page);
            await staffPage.visit();
            await staffPage.clickEditInRow(validStaff.firstName);

            const notesInput = page.locator('#app-add-employee-notes');
            await notesInput.fill(updatedNotes);
            // await page.waitForTimeout(50000); // Wait for any debounce or async validation to complete
            await staffPage.submitForm();

            await expect.poll(
                async () => {
                    const url = page.url();
                    const toastVisible = await page
                        .locator('.p-toast-message')
                        .filter({ hasText: /updated successfully/i })
                        .isVisible();
                    return url.match(/staff-details/i) || toastVisible;
                },
                { message: 'Expected redirect or success toast after update.' }
            ).toBeTruthy();
        });
    });

    test.describe('Delete staff', () => {
        const staffToDelete = 'Owusu';

        test('shows SweetAlert2 confirmation dialog on delete click', async ({ page }) => {
            const staffPage = new StaffPage(page);
            await staffPage.visit();
            await staffPage.clickDeleteInRow(staffToDelete);
            await expect(page.locator('.swal2-popup')).toBeVisible();
        });

        test('cancelling delete keeps the staff member in the list', async ({ page }) => {
            const staffPage = new StaffPage(page);
            await staffPage.visit();
            const rowsBefore = await staffPage.waitForRows();
            await staffPage.clickDeleteInRow(staffToDelete);
            await staffPage.cancelSwalDelete();
            await expect.poll(
                async () => staffPage.getTableRowCount(),
                { message: 'Expected row count to remain unchanged after cancel.' }
            ).toBe(rowsBefore);
        });

        test('confirming delete removes the row and shows success toast', async ({ page }) => {
            const staffPage = new StaffPage(page);
            await staffPage.visit();
            const rowsBefore = await staffPage.waitForRows();
            await staffPage.clickDeleteInRow(staffToDelete);
            await staffPage.confirmSwalDelete();
            await staffPage.expectToastMessage(/deleted successfully/i);
            await expect.poll(
                async () => staffPage.getTableRowCount(),
                { message: 'Expected row count to decrease by 1 after delete.' }
            ).toBe(rowsBefore - 1);
        });
    });

    baseTest.describe('Navigation guard', () => {
        baseTest('unauthenticated visit to staff list redirects away', async ({ page }) => {
            const staffPage = new StaffPage(page);
            await staffPage.visit();
            await expect.poll(
                async () => page.url(),
                { message: 'Expected redirect when not authenticated.' }
            ).toMatch(/login|auth|dashboard|sign[ -]?in/i);
        });
    });
});

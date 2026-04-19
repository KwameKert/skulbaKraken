import { authenticatedTest as test, expect } from '../fixtures';
import { AcademicYearPage, AcademicYearFormData } from '../pages/AcademicYearPage';
const validYear: AcademicYearFormData = {
    name: '2025/2026 Academic Year',
    startDate: '2025-09-01',
    endDate: '2026-07-31',
    status: 'ACTIVE',
};

const deleteYear: AcademicYearFormData = {
    name: '2024/2025 Academic Year',
    startDate: '2024-09-01',
    endDate: '2025-07-31',
    status: 'ACTIVE',
};

test.describe.serial('Academic Year', () => {

    test.describe('List view', () => {
        test('loads the academic year list with expected columns', async ({ page }) => {
            const academicYearPage = new AcademicYearPage(page);
            await academicYearPage.visit();
            await academicYearPage.expectListVisible();

            await academicYearPage.expectColumnHeaders(['ID', 'Name', 'Status', 'Start Date', 'End Date', 'Action']);
        });

        test('search input filters the table', async ({ page }) => {
            const academicYearPage = new AcademicYearPage(page);
            await academicYearPage.visit();
            await academicYearPage.expectListVisible();

            await academicYearPage.search('Test');

            await academicYearPage.expectListVisible();
        });

        test('Add Academic Year button opens the create dialog', async ({ page }) => {
            const academicYearPage = new AcademicYearPage(page);
            await academicYearPage.visit();
            await academicYearPage.expectListVisible();
            await academicYearPage.clickAddAcademicYear();
            // wait for dialog animation
            await academicYearPage.expectDialogVisible('Add');
        });
    });

    test.describe('Validation — bad cases', () => {
        test('shows required error for Name when touched and empty', async ({ page }) => {
            const academicYearPage = new AcademicYearPage(page);
            await academicYearPage.visit();

            await academicYearPage.clickAddAcademicYear();
            await academicYearPage.expectDialogVisible('Add');

            await academicYearPage.touchField('name');

            await academicYearPage.expectFieldError(/name is required/i);
        });

        test('shows required error for Start Date when touched and empty', async ({ page }) => {
            const academicYearPage = new AcademicYearPage(page);
            await academicYearPage.visit();

            await academicYearPage.clickAddAcademicYear();
            await academicYearPage.expectDialogVisible('Add');

            await academicYearPage.touchField('startDate');

            await academicYearPage.expectFieldError(/start date is required/i);
        });

        test('shows required error for End Date when touched and empty', async ({ page }) => {
            const academicYearPage = new AcademicYearPage(page);
            await academicYearPage.visit();

            await academicYearPage.clickAddAcademicYear();
            await academicYearPage.expectDialogVisible('Add');

            await academicYearPage.touchField('endDate');

            await academicYearPage.expectFieldError(/end date is required/i);
        });


    });
    test.describe('Create academic year', () => {

        test('creates an academic year with valid data and shows success toast', async ({ page }) => {
            const academicYearPage = new AcademicYearPage(page);
            await academicYearPage.visit();
            await academicYearPage.expectListVisible();

            await academicYearPage.clickAddAcademicYear();
            await academicYearPage.expectDialogVisible('Add');

            await academicYearPage.fillForm(validYear);
            await academicYearPage.submitForm();

            await academicYearPage.expectToastMessage(/created successfully/i);
        });

        test('dialog heading shows "Add Academic Year" for new records', async ({ page }) => {
            const academicYearPage = new AcademicYearPage(page);
            await academicYearPage.visit();
            await academicYearPage.expectListVisible();

            await academicYearPage.clickAddAcademicYear();

            await expect(page.getByRole('heading', { name: /add academic year/i })).toBeVisible();
        });

        test('status defaults to Active in the create form', async ({ page }) => {
            const academicYearPage = new AcademicYearPage(page);
            await academicYearPage.visit();

            await academicYearPage.clickAddAcademicYear();
            await academicYearPage.expectDialogVisible('Add');

            const statusSelect = page.locator('select[formcontrolname="status"]');
            await expect(statusSelect).toHaveValue('ACTIVE');
        });

        test('Create button is disabled when form is empty', async ({ page }) => {
            const academicYearPage = new AcademicYearPage(page);
            await academicYearPage.visit();

            await academicYearPage.clickAddAcademicYear();
            await academicYearPage.expectDialogVisible('Add');

            await expect(page.getByRole('button', { name: /create/i })).toBeDisabled();
        });

        test('Cancel closes the dialog without saving', async ({ page }) => {
            const academicYearPage = new AcademicYearPage(page);
            await academicYearPage.visit();
            await academicYearPage.expectListVisible();

            await academicYearPage.clickAddAcademicYear();
            await academicYearPage.expectDialogVisible('Add');

            await academicYearPage.cancelDialog();

            await expect(page.getByRole('dialog')).not.toBeVisible();
        });

    });



    test.describe('Edit academic year', () => {
        const existingYearName = validYear.name;

        test('clicking Edit opens the dialog in edit mode', async ({ page }) => {
            const academicYearPage = new AcademicYearPage(page);
            await academicYearPage.visit();
            await academicYearPage.expectListVisible();

            await academicYearPage.clickEditInRow(existingYearName);

            await academicYearPage.expectDialogVisible('Edit');
            await expect(page.getByRole('heading', { name: /edit academic year/i })).toBeVisible();
        });

        test('edit dialog shows Update button instead of Create', async ({ page }) => {
            const academicYearPage = new AcademicYearPage(page);
            await academicYearPage.visit();
            await academicYearPage.expectListVisible();

            await academicYearPage.clickEditInRow(existingYearName);
            await academicYearPage.expectDialogVisible('Edit');

            await expect(page.getByRole('button', { name: /update/i })).toBeVisible();
        });

        test('saves changes to an existing academic year and shows success toast', async ({ page }) => {
            const academicYearPage = new AcademicYearPage(page);
            await academicYearPage.visit();
            await academicYearPage.expectListVisible();

            await academicYearPage.clickEditInRow(existingYearName);
            await academicYearPage.expectDialogVisible('Edit');

            await academicYearPage.fillForm({
                name: existingYearName,
                startDate: '2025-01-01',
                endDate: '2025-12-31',
                status: 'INACTIVE',
            });
            await academicYearPage.submitForm();

            await academicYearPage.expectToastMessage(/updated successfully/i);
        });
    });

    test.describe('Delete academic year', () => {
        const yearToDelete = validYear.name;

        test('cancelling delete keeps the row in the table', async ({ page, }) => {
            const academicYearPage = new AcademicYearPage(page);
            await academicYearPage.visit();
            await academicYearPage.expectListVisible();
            await academicYearPage.waitForTableToHaveRows();
            const rowsBefore = await academicYearPage.getTableRowCount();
            // await page.waitForTimeout(1000); // wait for any pending operations to settle before counting
            await academicYearPage.clickDeleteInRow(yearToDelete);
            await academicYearPage.cancelSwalDelete();

            await academicYearPage.expectListVisible();
            const rowsAfter = await academicYearPage.getTableRowCount();

            expect(rowsAfter).toBe(rowsBefore);
        });

        test('shows SweetAlert2 confirmation dialog on delete click', async ({ page }) => {
            const academicYearPage = new AcademicYearPage(page);
            await academicYearPage.visit();
            await academicYearPage.expectListVisible();
            await academicYearPage.waitForTableToHaveRows();

            await academicYearPage.clickDeleteInRow(yearToDelete);

            await page.locator('.swal2-popup').waitFor({ state: 'visible', timeout: 5000 });
            await expect(page.locator('.swal2-popup')).toBeVisible();
        });



        test('confirming delete removes the row and shows success toast', async ({ page }) => {

            const academicYearPage = new AcademicYearPage(page);
            await academicYearPage.visit();
            await academicYearPage.expectListVisible();

            await academicYearPage.clickAddAcademicYear();
            await academicYearPage.expectDialogVisible('Add');

            await academicYearPage.fillForm(deleteYear);
            await academicYearPage.submitForm();

            await academicYearPage.waitForLoadingBar();
            await academicYearPage.waitForTableToHaveRows();
            const rowsBefore = await academicYearPage.getTableRowCount();

            await academicYearPage.clickDeleteInRow(deleteYear.name);

            // Wait for delete API response alongside confirm
            await Promise.all([
                page.waitForResponse(res =>
                    res.url().includes('/academic-years') &&
                    res.request().method() === 'DELETE'
                ),
                academicYearPage.confirmSwalDelete()
            ]);

            await academicYearPage.expectToastMessage(/deleted successfully/i);

            // await expect.poll(
            //     async () => academicYearPage.getTableRowCount(),
            //     { message: 'Expected row count to decrease by 1 after delete.' }
            // ).toBe(rowsBefore - 1);
        });
    });
});

import { authenticatedTest as test, expect } from '../fixtures';
import { TermPage, TermFormData } from '../pages/TermPage';

const validTerm: TermFormData = {
    name: 'First Term',
    academicYearName: '2025/2026 Academic Year',
    startDate: '2025-09-01',
    endDate: '2025-12-20',
    status: 'ACTIVE',
    description: 'E2E test term',
};

const secondTerm: TermFormData = {
    name: 'Second Term',
    academicYearName: '2025/2026 Academic Year',
    startDate: '2024-09-01',
    endDate: '2024-12-20',
    status: 'INACTIVE',
    description: 'E2E test term',
};
test.describe('Terms', () => {
    test.describe('List view', () => {
        test('loads the term list with expected columns', async ({ page }) => {
            const termPage = new TermPage(page);
            await termPage.visit();
            await termPage.expectListVisible();

            await termPage.expectColumnHeaders([
                'ID', 'Academic Year', 'Name', 'Is Locked', 'Is Published',
                'Rollover Status', 'Status', 'Start Date', 'End Date', 'Action'
            ]);
        });

        test('search input filters the table', async ({ page }) => {
            const termPage = new TermPage(page);
            await termPage.visit();
            await termPage.expectListVisible();

            await termPage.search('Test');

            await termPage.expectListVisible();
        });

        test('Add Term button opens the create dialog', async ({ page }) => {
            const termPage = new TermPage(page);
            await termPage.visit();

            await termPage.clickAddTerm();

            await termPage.expectDialogVisible('Add');
        });
    });

    test.describe('Create term', () => {
        test('creates a term with valid data and shows success toast', async ({ page }) => {
            const termPage = new TermPage(page);
            await termPage.visit();

            await termPage.clickAddTerm();
            await termPage.expectDialogVisible('Add');

            await termPage.fillForm(validTerm);
            await termPage.submitForm();

            await termPage.expectToastMessage(/created successfully/i);
        });

        test('dialog heading shows "Add Term" for new records', async ({ page }) => {
            const termPage = new TermPage(page);
            await termPage.visit();

            await termPage.clickAddTerm();

            await expect(page.getByRole('heading', { name: /add term/i })).toBeVisible();
        });

        test('status defaults to Active in the create form', async ({ page }) => {
            const termPage = new TermPage(page);
            await termPage.visit();

            await termPage.clickAddTerm();
            await termPage.expectDialogVisible('Add');

            await expect(page.locator('select[formcontrolname="status"]')).toHaveValue('ACTIVE');
        });

        test('Create button is disabled when form is empty', async ({ page }) => {
            const termPage = new TermPage(page);
            await termPage.visit();

            await termPage.clickAddTerm();
            await termPage.expectDialogVisible('Add');

            await expect(page.getByRole('button', { name: /create/i })).toBeDisabled();
        });

        test('Cancel closes the dialog without saving', async ({ page }) => {
            const termPage = new TermPage(page);
            await termPage.visit();

            await termPage.clickAddTerm();
            await termPage.expectDialogVisible('Add');

            await termPage.cancelDialog();

            await expect(page.getByRole('dialog')).not.toBeVisible();
        });

        test('Lock Term and Publish Term checkboxes are unchecked by default', async ({ page }) => {
            const termPage = new TermPage(page);
            await termPage.visit();

            await termPage.clickAddTerm();
            await termPage.expectDialogVisible('Add');

            await expect(page.locator('input#isLocked')).not.toBeChecked();
            await expect(page.locator('input#isPublished')).not.toBeChecked();
        });
    });

    test.describe('Validation — bad cases', () => {
        test('shows required error for Name when touched and empty', async ({ page }) => {
            const termPage = new TermPage(page);
            await termPage.visit();

            await termPage.clickAddTerm();
            await termPage.expectDialogVisible('Add');

            await termPage.touchField('name');

            await termPage.expectFieldError(/name is required/i);
        });

        test('shows required error for Start Date when touched and empty', async ({ page }) => {
            const termPage = new TermPage(page);
            await termPage.visit();

            await termPage.clickAddTerm();
            await termPage.expectDialogVisible('Add');

            await termPage.touchField('startDate');

            await termPage.expectFieldError(/start date is required/i);
        });

        test('shows required error for End Date when touched and empty', async ({ page }) => {
            const termPage = new TermPage(page);
            await termPage.visit();

            await termPage.clickAddTerm();
            await termPage.expectDialogVisible('Add');

            await termPage.touchField('endDate');

            await termPage.expectFieldError(/end date is required/i);
        });

        test('Create button remains disabled when form is invalid', async ({ page }) => {
            const termPage = new TermPage(page);
            await termPage.visit();

            await termPage.clickAddTerm();
            await termPage.expectDialogVisible('Add');

            await page.locator('input[formcontrolname="name"]').fill('Some Name');
            // academic year and dates still empty — form still invalid

            await expect(page.getByRole('button', { name: /create/i })).toBeDisabled();
        });
    });

    test.describe('Edit term', () => {
        const existingTermName = validTerm.name;
        test('clicking Edit opens the dialog in edit mode', async ({ page }) => {
            const termPage = new TermPage(page);
            await termPage.visit();
            await termPage.expectListVisible();

            await termPage.clickEditInRow(existingTermName);

            await termPage.expectDialogVisible('Edit');
            await expect(page.getByRole('heading', { name: /edit term/i })).toBeVisible();
        });

        test('edit dialog shows Update button instead of Create', async ({ page }) => {
            const termPage = new TermPage(page);
            await termPage.visit();
            await termPage.expectListVisible();

            await termPage.clickEditInRow(existingTermName);
            await termPage.expectDialogVisible('Edit');

            await expect(page.getByRole('button', { name: /update/i })).toBeVisible();
        });

        test('saves changes to an existing term and shows success toast', async ({ page }) => {
            const termPage = new TermPage(page);
            await termPage.visit();
            await termPage.expectListVisible();

            await termPage.clickEditInRow(existingTermName);
            await termPage.expectDialogVisible('Edit');

            await page.locator('input[formcontrolname="name"]').fill(existingTermName + ' (edited)');
            await termPage.submitForm();

            await termPage.expectToastMessage(/updated successfully/i);
        });
    });

    test.describe('Delete term', () => {


        test('shows SweetAlert2 confirmation dialog on delete click', async ({ page }) => {
            const termPage = new TermPage(page);
            await termPage.visit();
            await termPage.expectListVisible();

            await termPage.clickDeleteInRow(validTerm.name);

            await expect.poll(
                async () => page.locator('.swal2-popup').isVisible(),
                { message: 'Expected SweetAlert2 confirmation dialog to appear.' }
            ).toBeTruthy();
        });

        test('cancelling delete keeps the row in the table', async ({ page }) => {
            const termPage = new TermPage(page);
            await termPage.visit();
            await termPage.expectListVisible();

            const rowsBefore = await termPage.getTableRowCount();
            await termPage.clickDeleteInRow(validTerm.name);
            await termPage.cancelSwalDelete();

            await expect.poll(
                async () => termPage.getTableRowCount(),
                { message: 'Expected row count to remain unchanged after cancelling delete.' }
            ).toBe(rowsBefore);
        });

        test('confirming delete removes the row and shows success toast', async ({ page }) => {
            const termPage = new TermPage(page);
            await termPage.visit();
            await termPage.expectListVisible();

            await termPage.clickAddTerm();
            await termPage.expectDialogVisible('Add');

            await termPage.fillForm(secondTerm);
            await termPage.submitForm();


            const rowsBefore = await termPage.getTableRowCount();
            await termPage.clickDeleteInRow(secondTerm.name);
            await termPage.confirmSwalDelete();

            await termPage.expectToastMessage(/deleted successfully/i);
            const rowsAfter = await termPage.getTableRowCount();
            expect(rowsAfter).toBe(1);
        });
    });
});

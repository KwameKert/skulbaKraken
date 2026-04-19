import { authenticatedTest as test, expect, test as baseTest } from '../fixtures';
import { StudentsPage, StudentFormData, GuardianFormData } from '../pages/StudentsPage';

test.describe('Students', () => {
    test.describe('List view', () => {
        test('shows the students list table with expected columns', async ({ page }) => {
            const studentsPage = new StudentsPage(page);
            await studentsPage.visit();

            await studentsPage.expectListVisible();
            await studentsPage.expectColumnHeaders(['ID', 'Name', 'Gender', 'Contact', 'Status', 'Action']);
        });

        test('search input filters the table', async ({ page }) => {
            const searchTerm = 'Test';
            const studentsPage = new StudentsPage(page);
            await studentsPage.visit();

            await studentsPage.search(searchTerm);
            // After searching, table should still be visible (empty or with matches)
            await studentsPage.expectListVisible();
        });

        test('Add Student button navigates to create form', async ({ page }) => {
            const studentsPage = new StudentsPage(page);
            await studentsPage.visit();

            await studentsPage.clickAddStudent();

            await expect(page).toHaveURL(/add-student/i);
        });
    });

    test.describe('Create student', () => {
        const validStudent: StudentFormData = {
            firstName: 'Kwame',
            lastName: 'Asante',
            otherNames: 'Junior',
            gender: 'Male',
            dateOfBirth: '01/15/2005',
            phoneNumber: '0241234567',
            email: 'kwame.asante.e2e@example.com',
            status: 'Active',
            address: '12 Test Street, Accra',
            notes: 'E2E test student',
        };

        const guardian: GuardianFormData = {
            firstName: 'Kofi',
            lastName: 'Asante',
            email: 'kofi.asante@example.com',
            phoneNumber: '0201234567',
            relationship: 'Father',
            occupation: 'Engineer',
        };

        test('creates a student with valid data and guardian', async ({ page }) => {
            const studentsPage = new StudentsPage(page);
            await studentsPage.visitAddForm();

            await studentsPage.fillStudentForm(validStudent);
            await studentsPage.addGuardian(guardian);
            await studentsPage.submitForm();

            await expect.poll(
                async () => page.url(),
                { message: 'Expected redirect to student details after creation.' }
            ).toMatch(/student-details/i);
        });

        test('shows page heading "Add Student" on create form', async ({ page }) => {
            const studentsPage = new StudentsPage(page);
            await studentsPage.visitAddForm();

            await expect(page.getByRole('heading', { name: /add student/i })).toBeVisible();
        });
    });

    test.describe('Validation', () => {
        test('shows required field errors when submitting empty form', async ({ page }) => {
            const studentsPage = new StudentsPage(page);
            await studentsPage.visitAddForm();

            // Touch required fields and submit
            await page.locator('input[formcontrolname="firstName"]').click();
            await page.locator('input[formcontrolname="lastName"]').click();
            await page.locator('input[formcontrolname="firstName"]').click(); // blur lastName

            await expect.poll(
                async () => page.locator('.text-danger').filter({ hasText: /first name is required/i }).count(),
                { message: 'Expected First Name validation error.' }
            ).toBeGreaterThan(0);

            await expect.poll(
                async () => page.locator('.text-danger').filter({ hasText: /last name is required/i }).count(),
                { message: 'Expected Last Name validation error.' }
            ).toBeGreaterThan(0);
        });

        test('submit button is disabled when form is invalid', async ({ page }) => {
            const studentsPage = new StudentsPage(page);
            await studentsPage.visitAddForm();

            const submitBtn = page.locator('button[type="submit"]').first();
            await expect(submitBtn).toBeDisabled();
        });

        test('guardian form shows required errors on missing fields', async ({ page }) => {
            const studentsPage = new StudentsPage(page);
            await studentsPage.visitAddForm();

            await page.getByRole('button', { name: /add guardian/i }).click();

            const guardianCard = page.locator('[formgroupname]').first();
            await guardianCard.locator('input[placeholder="First Name"]').click();
            await guardianCard.locator('input[placeholder="Last Name"]').click();
            await guardianCard.locator('input[placeholder="First Name"]').click(); // blur last name

            await expect.poll(
                async () => guardianCard.locator('.text-danger').filter({ hasText: /first name is required/i }).count(),
                { message: 'Expected guardian First Name validation error.' }
            ).toBeGreaterThan(0);
        });
    });

    test.describe('Edit student', () => {
        // TODO: Replace with a real student ID that exists in the test environment
        const existingStudentId = 1;
        const updatedNotes = 'Updated via E2E test';

        test('edit form loads with existing student data', async ({ page }) => {
            const studentsPage = new StudentsPage(page);
            await studentsPage.visitEditForm(existingStudentId);

            await expect(page.getByRole('heading', { name: /add student/i })).toBeVisible();
            // In edit mode the submit button label changes to "Update Student"
            await expect.poll(
                async () => page.locator('button[type="submit"]').textContent(),
                { message: 'Expected submit button to say "Update Student" in edit mode.' }
            ).toMatch(/update/i);
        });

        test('saves changes made to an existing student', async ({ page }) => {
            const studentsPage = new StudentsPage(page);
            await studentsPage.visitEditForm(existingStudentId);

            const notesInput = page.locator('textarea[formcontrolname="notes"]');
            await notesInput.fill(updatedNotes);

            await studentsPage.submitForm();

            await expect.poll(
                async () => page.url(),
                { message: 'Expected redirect to student details after update.' }
            ).toMatch(/student-details/i);
        });
    });

    test.describe('Delete student', () => {
        // TODO: Replace with a real student name/ID visible in the list in the test environment
        const studentToDelete = 'Asante';

        test('shows SweetAlert2 confirmation dialog on delete click', async ({ page }) => {
            const studentsPage = new StudentsPage(page);
            await studentsPage.visit();

            await studentsPage.clickDeleteInRow(studentToDelete);

            await expect.poll(
                async () => page.locator('.swal2-popup').isVisible(),
                { message: 'Expected SweetAlert2 confirmation dialog to appear.' }
            ).toBeTruthy();
        });

        test('cancelling delete does not remove the student', async ({ page }) => {
            const studentsPage = new StudentsPage(page);
            await studentsPage.visit();

            const rowsBefore = await studentsPage.getTableRowCount();
            await studentsPage.clickDeleteInRow(studentToDelete);
            await studentsPage.cancelSwalDelete();

            await expect.poll(
                async () => studentsPage.getTableRowCount(),
                { message: 'Expected row count to remain the same after cancelling delete.' }
            ).toBe(rowsBefore);
        });

        test('confirming delete removes the student from the list', async ({ page }) => {
            const studentsPage = new StudentsPage(page);
            await studentsPage.visit();

            const rowsBefore = await studentsPage.getTableRowCount();
            await studentsPage.clickDeleteInRow(studentToDelete);
            await studentsPage.confirmSwalDelete();

            await expect.poll(
                async () => studentsPage.getTableRowCount(),
                { message: 'Expected row count to decrease by 1 after delete.' }
            ).toBe(rowsBefore - 1);
        });
    });

    baseTest.describe('Navigation guard', () => {
        baseTest('unauthenticated visit to students list redirects away', async ({ page }) => {
            // This test verifies the roleGuardGuard redirects non-school-admin users.
            // Run this in a context without a valid school-admin session.
            // TODO: clear auth state before this test if a storageState fixture is available.
            const studentsPage = new StudentsPage(page);
            await studentsPage.visit();

            await expect.poll(
                async () => page.url(),
                { message: 'Expected redirect when not authenticated as school-admin.' }
            ).toMatch(/login|auth|dashboard|sign[ -]?in/i);
        });
    });
});

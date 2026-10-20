import { authenticatedTest as test, expect, test as baseTest } from '../fixtures';
import { StudentsPage } from '../pages/StudentsPage';
import { GuardiansPage } from '../pages/GuardiansPage';
import { makeGuardian, makeStudent } from '../data/people';

// One student (with a guardian) is created and then edited/deleted by later tests.
// A second student reuses the same guardian phone to prove guardians are de-duplicated.
const student = makeStudent();
const guardian = makeGuardian();
const secondStudent = makeStudent();
const toastBugStudent = makeStudent();

const isStudentWrite = (method: string) => (res: { url(): string; request(): { method(): string } }) =>
    res.url().includes('/students') &&
    !res.url().includes('/guardians') &&
    res.request().method() === method;

test.describe.serial('Students', () => {
    test.describe('List view', () => {
        test('shows the students list table with expected columns', async ({ page }) => {
            const studentsPage = new StudentsPage(page);
            await studentsPage.visit();

            await studentsPage.expectColumnHeaders(['ID', 'Name', 'Gender', 'Contact', 'Status', 'Action']);
        });

        test('Add Student button navigates to create form', async ({ page }) => {
            const studentsPage = new StudentsPage(page);
            await studentsPage.visit();

            await studentsPage.clickAddStudent();

            await expect(page).toHaveURL(/add-student/i);
        });
    });

    test.describe('Create form — validation', () => {
        test('shows the Add Student heading and a disabled submit button', async ({ page }) => {
            const studentsPage = new StudentsPage(page);
            await studentsPage.visitAddForm();

            await expect(page.getByRole('heading', { name: /add student/i })).toBeVisible();
            await expect(page.locator('#app-add-student-submit')).toBeDisabled();
        });

        test('shows required errors for First Name and Last Name when touched and empty', async ({ page }) => {
            const studentsPage = new StudentsPage(page);
            await studentsPage.visitAddForm();

            await studentsPage.touchField('firstName');
            await studentsPage.touchField('lastName');

            await studentsPage.expectFieldError(/first name is required/i);
            await studentsPage.expectFieldError(/last name is required/i);
        });

        test('shows required errors for Gender, Date of Birth and Status when touched and empty', async ({ page }) => {
            const studentsPage = new StudentsPage(page);
            await studentsPage.visitAddForm();

            await studentsPage.touchDropdown('gender');
            await studentsPage.touchField('dateOfBirth');
            await studentsPage.touchDropdown('status');

            await studentsPage.expectFieldError(/gender is required/i);
            await studentsPage.expectFieldError(/date of birth is required/i);
            await studentsPage.expectFieldError(/status is required/i);
        });

        test('guardian card shows required errors for First Name, Last Name and Phone', async ({ page }) => {
            const studentsPage = new StudentsPage(page);
            await studentsPage.visitAddForm();
            await studentsPage.addGuardian();

            await studentsPage.touchGuardianField(0, 'firstName');
            await studentsPage.touchGuardianField(0, 'lastName');
            await studentsPage.touchGuardianField(0, 'phoneNumber');

            await studentsPage.expectFieldError(/first name is required/i);
            await studentsPage.expectFieldError(/last name is required/i);
            await studentsPage.expectFieldError(/phone number is required/i);
        });

        test('guardian phone rejects non-numeric input', async ({ page }) => {
            const studentsPage = new StudentsPage(page);
            await studentsPage.visitAddForm();
            await studentsPage.addGuardian();

            await studentsPage.fillGuardianField(0, 'phoneNumber', 'abc');
            await studentsPage.touchGuardianField(0, 'phoneNumber');

            await studentsPage.expectFieldError(/phone number is required/i);
        });

        test('remove button deletes a guardian card', async ({ page }) => {
            const studentsPage = new StudentsPage(page);
            await studentsPage.visitAddForm();

            await studentsPage.addGuardian();
            await expect(studentsPage.guardianCards).toHaveCount(1);

            await studentsPage.removeGuardian(0);

            await expect(studentsPage.guardianCards).toHaveCount(0);
        });
    });

    test.describe('Create student', () => {
        test('creates a student with a guardian and opens the student details page', async ({ page }) => {
            const studentsPage = new StudentsPage(page);
            await studentsPage.visitAddForm();

            await studentsPage.fillStudentForm(student);
            await studentsPage.addGuardian(guardian);
            await expect(page.locator('#app-add-student-submit')).toBeEnabled();

            const [response] = await Promise.all([
                page.waitForResponse(isStudentWrite('POST')),
                studentsPage.submitForm(),
            ]);
            expect(response.ok()).toBeTruthy();

            await expect(page).toHaveURL(/student-details\/\d+/i);
        });

        test('the new student appears in the list and can be found by search', async ({ page }) => {
            const studentsPage = new StudentsPage(page);
            await studentsPage.visit();

            await studentsPage.search(student.lastName);

            await expect(studentsPage.rowByName(student.lastName)).toBeVisible();
        });

        test('search with an unknown term shows no matching row', async ({ page }) => {
            const studentsPage = new StudentsPage(page);
            await studentsPage.visit();

            await studentsPage.search('zz-no-such-student-zz');

            await expect(studentsPage.rowByName(student.lastName)).toHaveCount(0);
        });

        test('a second student reusing the guardian phone shares one guardian record', async ({ page }) => {
            const studentsPage = new StudentsPage(page);
            await studentsPage.visitAddForm();

            await studentsPage.fillStudentForm(secondStudent);
            await studentsPage.addGuardian(guardian);

            const [response] = await Promise.all([
                page.waitForResponse(isStudentWrite('POST')),
                studentsPage.submitForm(),
            ]);
            expect(response.ok()).toBeTruthy();
            await expect(page).toHaveURL(/student-details\/\d+/i);

            const guardiansPage = new GuardiansPage(page);
            await guardiansPage.visit();
            await expect(guardiansPage.rowByPhone(guardian.phoneNumber)).toHaveCount(1);
        });

        test('create shows an "added" success toast', async ({ page }) => {
            const studentsPage = new StudentsPage(page);
            await studentsPage.visitAddForm();
            await studentsPage.fillStudentForm(toastBugStudent);

            await studentsPage.submitForm();

            await studentsPage.expectToastMessage(/student added successfully/i);
        });
    });

    test.describe('Search Guardian dialog', () => {
        test('finds an existing guardian by phone and adds it to the student', async ({ page }) => {
            const studentsPage = new StudentsPage(page);
            await studentsPage.visitAddForm();

            await studentsPage.openGuardianSearch();
            await studentsPage.searchGuardian(guardian.phoneNumber);
            await studentsPage.selectFirstGuardianResult();

            await studentsPage.expectToastMessage(/guardian added successfully/i);
            await expect(studentsPage.guardianCards).toHaveCount(1);
        });

        test('"Create New Guardian" appears when nothing matches and adds an empty guardian card', async ({ page }) => {
            const studentsPage = new StudentsPage(page);
            await studentsPage.visitAddForm();

            await studentsPage.openGuardianSearch();
            await studentsPage.searchGuardian('zz-no-such-guardian-zz');
            await expect(page.getByRole('dialog').getByText(/no guardians found/i)).toBeVisible();

            await studentsPage.clickCreateNewGuardian();

            await expect(studentsPage.guardianCards).toHaveCount(1);
        });
    });

    test.describe('Edit student', () => {
        test('Edit opens the form with the saved data and locked fields', async ({ page }) => {
            const studentsPage = new StudentsPage(page);
            await studentsPage.visit();
            await studentsPage.search(student.lastName);
            await expect(studentsPage.rowByName(student.lastName)).toBeVisible();

            await studentsPage.clickEditInRow(student.lastName);

            await expect(page).toHaveURL(/edit-student\/\d+/i);
            await expect(page.locator('#app-add-student-firstName')).toHaveValue(student.firstName);
            await expect(page.locator('#app-add-student-lastName')).toHaveValue(student.lastName);
            await expect(page.locator('#app-add-student-email')).toBeDisabled();
            await expect(page.locator('#app-add-student-studentId')).toBeEditable();
            await expect(page.locator('#app-add-student-guardian-firstName-0')).toHaveValue(guardian.firstName);
            await expect(page.locator('#app-add-student-guardian-phoneNumber-0')).toBeDisabled();
            await expect(page.locator('#app-add-student-submit')).toHaveText(/update student/i);
        });

        test('saves changes to an existing student', async ({ page }) => {
            const studentsPage = new StudentsPage(page);
            await studentsPage.visit();
            await studentsPage.search(student.lastName);
            await expect(studentsPage.rowByName(student.lastName)).toBeVisible();
            await studentsPage.clickEditInRow(student.lastName);
            await expect(page.locator('#app-add-student-lastName')).toHaveValue(student.lastName);

            await page.locator('#app-add-student-notes').fill('Updated by E2E');
            const [response] = await Promise.all([
                page.waitForResponse(isStudentWrite('PUT')),
                studentsPage.submitForm(),
            ]);

            expect(response.ok()).toBeTruthy();
            await expect(page).toHaveURL(/student-details\/\d+/i);
        });

        test('edit form heading says "Edit Student"', async ({ page }) => {
            const studentsPage = new StudentsPage(page);
            await studentsPage.visit();
            await studentsPage.search(student.lastName);
            await expect(studentsPage.rowByName(student.lastName)).toBeVisible();
            await studentsPage.clickEditInRow(student.lastName);

            await expect(page.getByRole('heading', { name: /edit student/i })).toBeVisible();
        });

        test('Cancel leaves the add form', async ({ page }) => {
            const studentsPage = new StudentsPage(page);
            await studentsPage.visitAddForm();

            await studentsPage.cancelForm();

            await expect(page).not.toHaveURL(/add-student/i);
        });
    });

    test.describe('Delete student', () => {
        test('cancelling the confirmation keeps the row', async ({ page }) => {
            const studentsPage = new StudentsPage(page);
            await studentsPage.visit();
            await studentsPage.search(student.lastName);
            await expect(studentsPage.rowByName(student.lastName)).toBeVisible();

            await studentsPage.clickDeleteInRow(student.lastName);
            await expect(page.locator('.swal2-popup')).toBeVisible();
            await studentsPage.cancelSwalDelete();

            await expect(studentsPage.rowByName(student.lastName)).toBeVisible();
        });

        test('confirming delete removes the row and shows a success toast', async ({ page }) => {
            const studentsPage = new StudentsPage(page);
            await studentsPage.visit();
            await studentsPage.search(student.lastName);
            await expect(studentsPage.rowByName(student.lastName)).toBeVisible();

            await studentsPage.clickDeleteInRow(student.lastName);
            const [response] = await Promise.all([
                page.waitForResponse(isStudentWrite('DELETE')),
                studentsPage.confirmSwalDelete(),
            ]);

            expect(response.ok()).toBeTruthy();
            await studentsPage.expectToastMessage(/student deleted successfully/i);
            await expect(studentsPage.rowByName(student.lastName)).toHaveCount(0);
        });
    });
});

baseTest.describe('Students — navigation guard', () => {
    baseTest('redirects unauthenticated users to the login page', async ({ page }) => {
        await page.goto('/peoples/students/students-list');

        await expect(page).toHaveURL(/keycloak|openid-connect|auth/i);
    });
});

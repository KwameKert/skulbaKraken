import { authenticatedTest as test, expect } from '../fixtures';
import { StudentsPage } from '../pages/StudentsPage';
import { GuardiansPage } from '../pages/GuardiansPage';
import { makeGuardian, makeStudent } from '../data/people';

/**
 * Data-integrity flows for students: what was saved is what comes back after a reload,
 * guardians stay linked to the right students, and deleted records disappear everywhere.
 * One student with two guardians is created up front and the later tests build on it.
 */
const student = makeStudent({ gender: 'Female', otherNames: 'Adwoa' });
const primaryGuardian = makeGuardian({ relationship: 'Mother', isPrimary: true });
const secondGuardian = makeGuardian({ relationship: 'Father', isPrimary: false });
const replacementGuardian = makeGuardian({ relationship: 'Guardian', isPrimary: false });

let studentPath = '';

const isStudentWrite = (method: string) => (res: { url(): string; request(): { method(): string } }) =>
    res.url().includes('/students') &&
    !res.url().includes('/guardians') &&
    res.request().method() === method;

function guardianCard(page: import('@playwright/test').Page, lastName: string) {
    return page.locator('div.border.rounded.p-3').filter({ hasText: lastName });
}

test.describe.serial('Students — data integrity', () => {
    test('creates a student with a primary and a second guardian', async ({ page }) => {
        const studentsPage = new StudentsPage(page);
        await studentsPage.visitAddForm();

        await studentsPage.fillStudentForm(student);
        await studentsPage.addGuardian(primaryGuardian);
        await studentsPage.addGuardian(secondGuardian);

        const [response] = await Promise.all([
            page.waitForResponse(isStudentWrite('POST')),
            studentsPage.submitForm(),
        ]);
        expect(response.ok()).toBeTruthy();

        await expect(page).toHaveURL(/student-details\/\d+/i);
        studentPath = new URL(page.url()).pathname;
    });

    test('details page shows every saved student field after a reload', async ({ page }) => {
        await page.goto(studentPath);
        await page.reload();

        await expect(page.getByRole('heading', { name: new RegExp(student.lastName) })).toBeVisible();
        await expect(page.getByRole('heading', { name: new RegExp(student.otherNames!) })).toBeVisible();
        await expect(page.getByText(/^\s*ACTIVE\s*$/).first()).toBeVisible();
        await expect(page.getByText(/DOB\s*:\s*Jan 15, 2012/)).toBeVisible();
        await expect(page.getByText(/^\s*female\s*$/i)).toBeVisible();
        await expect(page.getByText(student.phoneNumber!)).toBeVisible();
        await expect(page.getByText(student.email!)).toBeVisible();
        await expect(page.getByText(student.address!)).toBeVisible();
    });

    test('details page lists both guardians with relationship and primary flag', async ({ page }) => {
        await page.goto(studentPath);

        await expect(page.getByText(/2 guardians/i)).toBeVisible();

        const primary = guardianCard(page, primaryGuardian.lastName);
        await expect(primary).toContainText('(Primary)');
        await expect(primary).toContainText(/mother/i);
        await expect(primary).toContainText(primaryGuardian.phoneNumber);
        await expect(primary).toContainText(primaryGuardian.email);

        const second = guardianCard(page, secondGuardian.lastName);
        await expect(second).toBeVisible();
        await expect(second).toContainText(/father/i);
        await expect(second).not.toContainText('(Primary)');
    });

    test('edit form is pre-filled with the saved values', async ({ page }) => {
        const studentsPage = new StudentsPage(page);
        await studentsPage.visitEditForm(studentPath.split('/').pop()!);

        await expect(page.locator('#app-add-student-firstName')).toHaveValue(student.firstName);
        await expect(page.locator('#app-add-student-lastName')).toHaveValue(student.lastName);
        await expect(page.locator('#app-add-student-otherNames')).toHaveValue(student.otherNames!);
        await expect(page.locator('#app-add-student-dateOfBirth')).toHaveValue(student.dateOfBirth);
        await expect(page.locator('#app-add-student-gender')).toContainText('Female');
        await expect(page.locator('#app-add-student-phoneNumber')).toHaveValue(student.phoneNumber!);
        await expect(page.locator('#app-add-student-address')).toHaveValue(student.address!);
        await expect(page.locator('#app-add-student-notes')).toHaveValue(student.notes!);
        await expect(studentsPage.guardianCards).toHaveCount(2);
    });

    test('the guardian details page lists the student as linked', async ({ page }) => {
        const guardiansPage = new GuardiansPage(page);
        await guardiansPage.visit();
        await guardiansPage.openDetailsFromRow(primaryGuardian.phoneNumber);

        await expect(page).toHaveURL(/guardian-details\/\d+/i);
        const linked = page.locator('table tbody tr').filter({ hasText: student.lastName });
        await expect(linked).toHaveCount(1);
    });

    test('editing replaces the guardian list: removed guardian is unlinked, new one is linked', async ({ page }) => {
        const studentsPage = new StudentsPage(page);
        await studentsPage.visitEditForm(studentPath.split('/').pop()!);
        await expect(studentsPage.guardianCards).toHaveCount(2);

        await studentsPage.removeGuardian(await studentsPage.guardianIndexByLastName(secondGuardian.lastName));
        await studentsPage.addGuardian(replacementGuardian);

        const [response] = await Promise.all([
            page.waitForResponse(isStudentWrite('PUT')),
            studentsPage.submitForm(),
        ]);
        expect(response.ok()).toBeTruthy();
        await expect(page).toHaveURL(/student-details\/\d+/i);

        await page.goto(studentPath);
        await page.reload();
        await expect(page.getByText(/2 guardians/i)).toBeVisible();
        await expect(guardianCard(page, primaryGuardian.lastName)).toBeVisible();
        await expect(guardianCard(page, replacementGuardian.lastName)).toBeVisible();
        await expect(guardianCard(page, secondGuardian.lastName)).toHaveCount(0);
    });

    test('the removed guardian still exists but is no longer linked to the student', async ({ page }) => {
        const guardiansPage = new GuardiansPage(page);
        await guardiansPage.visit();
        await expect(guardiansPage.rowByPhone(secondGuardian.phoneNumber)).toHaveCount(1);

        await guardiansPage.openDetailsFromRow(secondGuardian.phoneNumber);

        await expect(page.getByText(/no students linked to this guardian/i)).toBeVisible();
    });

    test('deleting the student removes it from the list and search', async ({ page }) => {
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

        await studentsPage.visit();
        await studentsPage.search(student.lastName);
        await expect(studentsPage.rowByName(student.lastName)).toHaveCount(0);
    });

    test('a deleted student is unlinked from its guardians', async ({ page }) => {
        const guardiansPage = new GuardiansPage(page);
        await guardiansPage.visit();
        await expect(guardiansPage.rowByPhone(primaryGuardian.phoneNumber)).toHaveCount(1);

        await guardiansPage.openDetailsFromRow(primaryGuardian.phoneNumber);

        await expect(page.getByText(/no students linked to this guardian/i)).toBeVisible();
    });

    test('opening a deleted student by URL does not show the student', async ({ page }) => {
        await page.goto(studentPath);

        // Wait for the page to settle, then make sure the deleted student's name never rendered.
        await page.waitForLoadState('networkidle');
        await expect(page.getByRole('heading', { name: new RegExp(student.lastName) })).toHaveCount(0);
    });
});

import { Page } from '@playwright/test';
import { authenticatedTest as test, expect } from '../fixtures';
import { StudentsPage } from '../pages/StudentsPage';
import { GuardiansPage } from '../pages/GuardiansPage';
import { makeGuardian, makeStudent } from '../data/people';

/**
 * Guardians only come into being through students, so these flows link one guardian to two
 * students and check the links hold up when the guardian is edited or deleted, and when a
 * student is deleted.
 */
const guardian = makeGuardian({ relationship: 'Mother', isPrimary: true });
const firstStudent = makeStudent();
const secondStudent = makeStudent();

let firstStudentPath = '';
let secondStudentPath = '';

const isStudentCreate = (res: { url(): string; request(): { method(): string } }) =>
    res.url().includes('/students') && !res.url().includes('/guardians') && res.request().method() === 'POST';

const isGuardianWrite = (method: string) => (res: { url(): string; request(): { method(): string } }) =>
    res.url().includes('/guardians') && res.request().method() === method;

async function createStudentWithGuardian(page: Page, student: ReturnType<typeof makeStudent>): Promise<string> {
    const studentsPage = new StudentsPage(page);
    await studentsPage.visitAddForm();
    await studentsPage.fillStudentForm(student);
    await studentsPage.addGuardian(guardian);

    const [response] = await Promise.all([page.waitForResponse(isStudentCreate), studentsPage.submitForm()]);
    expect(response.ok()).toBeTruthy();
    await expect(page).toHaveURL(/student-details\/\d+/i);
    return new URL(page.url()).pathname;
}

test.describe.serial('Guardians — data integrity', () => {
    test('two students created with the same guardian phone share one guardian', async ({ page }) => {
        firstStudentPath = await createStudentWithGuardian(page, firstStudent);
        secondStudentPath = await createStudentWithGuardian(page, secondStudent);

        const guardiansPage = new GuardiansPage(page);
        await guardiansPage.visit();
        await expect(guardiansPage.rowByPhone(guardian.phoneNumber)).toHaveCount(1);
    });

    test('the guardian details page lists both students', async ({ page }) => {
        const guardiansPage = new GuardiansPage(page);
        await guardiansPage.visit();
        await guardiansPage.openDetailsFromRow(guardian.phoneNumber);

        await expect(page).toHaveURL(/guardian-details\/\d+/i);
        await expect(page.getByText(guardian.email, { exact: true })).toBeVisible();
        await expect(page.locator('table tbody tr').filter({ hasText: firstStudent.lastName })).toHaveCount(1);
        await expect(page.locator('table tbody tr').filter({ hasText: secondStudent.lastName })).toHaveCount(1);
    });

    test('editing a guardian is reflected on the linked student', async ({ page }) => {
        const guardiansPage = new GuardiansPage(page);
        await guardiansPage.visit();
        await guardiansPage.clickEditInRow(guardian.phoneNumber);

        await guardiansPage.dialog.locator('input[formcontrolname="firstName"]').fill('Updatedname');
        await guardiansPage.dialog.locator('input[formcontrolname="occupation"]').fill('Surgeon');
        const [response] = await Promise.all([
            page.waitForResponse(isGuardianWrite('PATCH')),
            guardiansPage.submitModal(),
        ]);
        expect(response.ok()).toBeTruthy();

        await page.goto(firstStudentPath);
        await page.reload();
        const card = page.locator('div.border.rounded.p-3').filter({ hasText: guardian.lastName });
        await expect(card).toContainText('Updatedname');
        await expect(card).toContainText('Surgeon');
    });

    test('deleting the first student keeps the shared guardian linked to the second', async ({ page }) => {
        const studentsPage = new StudentsPage(page);
        await studentsPage.visit();
        await studentsPage.search(firstStudent.lastName);
        await expect(studentsPage.rowByName(firstStudent.lastName)).toBeVisible();
        await studentsPage.clickDeleteInRow(firstStudent.lastName);
        await Promise.all([
            page.waitForResponse(res => res.url().includes('/students') && res.request().method() === 'DELETE'),
            studentsPage.confirmSwalDelete(),
        ]);

        const guardiansPage = new GuardiansPage(page);
        await guardiansPage.visit();
        await expect(guardiansPage.rowByPhone(guardian.phoneNumber)).toHaveCount(1);
        await guardiansPage.openDetailsFromRow(guardian.phoneNumber);

        await expect(page.locator('table tbody tr').filter({ hasText: secondStudent.lastName })).toHaveCount(1);
        await expect(page.locator('table tbody tr').filter({ hasText: firstStudent.lastName })).toHaveCount(0);
    });

    test('deleting the guardian removes it from the list', async ({ page }) => {
        const guardiansPage = new GuardiansPage(page);
        await guardiansPage.visit();
        await expect(guardiansPage.rowByPhone(guardian.phoneNumber)).toHaveCount(1);

        await guardiansPage.clickDeleteInRow(guardian.phoneNumber);
        const [response] = await Promise.all([
            page.waitForResponse(isGuardianWrite('DELETE')),
            guardiansPage.confirmSwal(),
        ]);
        expect(response.ok()).toBeTruthy();

        await guardiansPage.visit();
        await expect(guardiansPage.rowByPhone(guardian.phoneNumber)).toHaveCount(0);
    });

    test('the deleted guardian no longer appears on the linked student', async ({ page }) => {
        await page.goto(secondStudentPath);
        await page.reload();

        await expect(page.getByRole('heading', { name: new RegExp(secondStudent.lastName) })).toBeVisible();
        await expect(page.locator('div.border.rounded.p-3').filter({ hasText: guardian.lastName })).toHaveCount(0);
        await expect(page.getByText(/no guardians have been added/i)).toBeVisible();
    });

    test('the deleted guardian cannot be found in the Search Guardian dialog', async ({ page }) => {
        const studentsPage = new StudentsPage(page);
        await studentsPage.visitAddForm();

        await studentsPage.openGuardianSearch();
        await studentsPage.searchGuardian(guardian.phoneNumber);

        await expect(page.getByRole('dialog').getByText(/no guardians found/i)).toBeVisible();
    });
});

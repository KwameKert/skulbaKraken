import { authenticatedTest as test, expect } from '../fixtures';
import { StudentsPage } from '../pages/StudentsPage';
import { makeGuardian, makeStudent } from '../data/people';

/**
 * Inactive records and hostile / unusual input. These are the cases that quietly corrupt a
 * people list: wrong status display, names that break layout, markup that gets executed.
 */
const inactiveStudent = makeStudent({ status: 'Inactive' });
const inactiveGuardian = makeGuardian();

const base = makeStudent();
const specialStudent = makeStudent({
    firstName: 'Zoë',
    lastName: `O'Brien-Müller${base.lastName}`,
    address: `<img src=x onerror="window.__xss=1"> 5 "Quote" & Sons Rd`,
    notes: `<script>window.__xss=1</script>`,
});
const specialGuardian = makeGuardian({
    firstName: 'Éric',
    lastName: `D'Souza${base.lastName}`,
});

const isStudentCreate = (res: { url(): string; request(): { method(): string } }) =>
    res.url().includes('/students') && !res.url().includes('/guardians') && res.request().method() === 'POST';

test.describe.serial('Students — inactive and unusual data', () => {
    test('an inactive student is saved as inactive and shown that way everywhere', async ({ page }) => {
        const studentsPage = new StudentsPage(page);
        await studentsPage.visitAddForm();
        await studentsPage.fillStudentForm(inactiveStudent);
        await studentsPage.addGuardian(inactiveGuardian);

        const [response] = await Promise.all([page.waitForResponse(isStudentCreate), studentsPage.submitForm()]);
        expect(response.ok()).toBeTruthy();
        await expect(page).toHaveURL(/student-details\/\d+/i);

        await page.reload();
        await expect(page.getByText(/^\s*INACTIVE\s*$/).first()).toBeVisible();

        await studentsPage.visit();
        await studentsPage.search(inactiveStudent.lastName);
        const row = studentsPage.rowByName(inactiveStudent.lastName);
        await expect(row).toBeVisible();
        await expect(row).toContainText(/inactive/i);
    });

    test('the edit form shows the saved Inactive status', async ({ page }) => {
        const studentsPage = new StudentsPage(page);
        await studentsPage.visit();
        await studentsPage.search(inactiveStudent.lastName);
        await expect(studentsPage.rowByName(inactiveStudent.lastName)).toBeVisible();
        await studentsPage.clickEditInRow(inactiveStudent.lastName);

        await expect(page.locator('#app-add-student-lastName')).toHaveValue(inactiveStudent.lastName);
        await expect(page.locator('#app-add-student-status')).toContainText('Inactive');
    });

    test('names with accents, apostrophes and markup are stored and shown as plain text', async ({ page }) => {
        const studentsPage = new StudentsPage(page);
        await studentsPage.visitAddForm();
        await studentsPage.fillStudentForm(specialStudent);
        await studentsPage.addGuardian(specialGuardian);

        const [response] = await Promise.all([page.waitForResponse(isStudentCreate), studentsPage.submitForm()]);
        expect(response.ok(), `status ${response.status()}: ${await response.text()}`).toBeTruthy();
        await expect(page).toHaveURL(/student-details\/\d+/i);

        await page.reload();
        await expect(page.getByRole('heading', { name: new RegExp(`Zoë.*O'Brien-Müller`) })).toBeVisible();
        await expect(page.getByText(`<img src=x onerror="window.__xss=1"> 5 "Quote" & Sons Rd`)).toBeVisible();
        await expect(page.getByText('Éric')).toBeVisible();
        expect(await page.evaluate(() => (window as unknown as { __xss?: number }).__xss)).toBeUndefined();
    });

    test('markup in a name is not executed in the students list or the edit form', async ({ page }) => {
        const studentsPage = new StudentsPage(page);
        await studentsPage.visit();
        await studentsPage.search(specialStudent.lastName);
        await expect(studentsPage.rowByName(specialStudent.lastName)).toBeVisible();
        expect(await page.evaluate(() => (window as unknown as { __xss?: number }).__xss)).toBeUndefined();

        await studentsPage.clickEditInRow(specialStudent.lastName);
        await expect(page.locator('#app-add-student-address')).toHaveValue(specialStudent.address!);
        await expect(page.locator('#app-add-student-notes')).toHaveValue(specialStudent.notes!);
        expect(await page.evaluate(() => (window as unknown as { __xss?: number }).__xss)).toBeUndefined();
    });

    test('a whitespace-only first name does not enable the submit button', async ({ page }) => {
        const studentsPage = new StudentsPage(page);
        await studentsPage.visitAddForm();
        await studentsPage.fillStudentForm(makeStudent());
        await studentsPage.addGuardian(makeGuardian());
        // control: the otherwise-valid form is submittable
        await expect(page.locator('#app-add-student-submit')).toBeEnabled();

        await page.locator('#app-add-student-firstName').fill('   ');

        await expect(page.locator('#app-add-student-submit')).toBeDisabled();
    });

    test('a student with no guardians can still be saved', async ({ page }) => {
        const studentsPage = new StudentsPage(page);
        await studentsPage.visitAddForm();
        await studentsPage.fillStudentForm(makeStudent());

        const [response] = await Promise.all([page.waitForResponse(isStudentCreate), studentsPage.submitForm()]);
        expect(response.ok()).toBeTruthy();
        await expect(page).toHaveURL(/student-details\/\d+/i);
        await page.reload();
        await expect(page.getByText(/no guardians have been added/i)).toBeVisible();
    });

    test.describe('Student ID uniqueness', () => {
        // Rule: two students cannot share a student ID, but the ID is optional (blank gets a generated one).
        const sharedId = `SID-${Date.now().toString(36)}`;
        const owner = makeStudent({ studentId: sharedId });
        const clash = makeStudent({ studentId: sharedId });
        const other = makeStudent({ studentId: `${sharedId}-B` });
        const blankA = makeStudent();
        const blankB = makeStudent();

        const isStudentWrite = (method: string) => (res: { url(): string; request(): { method(): string } }) =>
            res.url().includes('/students') && !res.url().includes('/guardians') && res.request().method() === method;

        async function createStudent(page: import('@playwright/test').Page, data: ReturnType<typeof makeStudent>) {
            const studentsPage = new StudentsPage(page);
            await studentsPage.visitAddForm();
            await studentsPage.fillStudentForm(data);
            return Promise.all([page.waitForResponse(isStudentWrite('POST')), studentsPage.submitForm()]);
        }

        test('a student can be created with their own student ID', async ({ page }) => {
            const [response] = await createStudent(page, owner);

            expect(response.ok(), `status ${response.status()}: ${await response.text()}`).toBeTruthy();
            await expect(page).toHaveURL(/student-details\/\d+/i);
            await page.reload();
            await expect(page.getByText(sharedId, { exact: true })).toBeVisible();
        });

        test('a second student with the same student ID is rejected and nothing is created', async ({ page }) => {
            const [response] = await createStudent(page, clash);

            expect(response.status()).toBeGreaterThanOrEqual(400);
            expect(response.status()).toBeLessThan(500);
            await expect(page.locator('.p-toast-message-error').first()).toBeVisible();
            await expect(page).toHaveURL(/add-student/i);

            const studentsPage = new StudentsPage(page);
            await studentsPage.visit();
            await studentsPage.search(clash.lastName);
            await expect(studentsPage.rowByName(clash.lastName)).toHaveCount(0);
        });

        test('editing a student to another student\'s ID is rejected', async ({ page }) => {
            const [created] = await createStudent(page, other);
            expect(created.ok(), `status ${created.status()}: ${await created.text()}`).toBeTruthy();

            const studentsPage = new StudentsPage(page);
            await studentsPage.visit();
            await studentsPage.search(other.lastName);
            await expect(studentsPage.rowByName(other.lastName)).toBeVisible();
            await studentsPage.clickEditInRow(other.lastName);
            await expect(page.locator('#app-add-student-lastName')).toHaveValue(other.lastName);

            await page.locator('#app-add-student-studentId').fill(sharedId);
            const [response] = await Promise.all([page.waitForResponse(isStudentWrite('PUT')), studentsPage.submitForm()]);

            expect(response.status()).toBeGreaterThanOrEqual(400);
            expect(response.status()).toBeLessThan(500);
            await expect(page.locator('.p-toast-message-error').first()).toBeVisible();
        });

        test('students created without a student ID each get their own generated one', async ({ page }) => {
            const ids: string[] = [];
            for (const data of [blankA, blankB]) {
                const [response] = await createStudent(page, data);
                expect(response.ok(), `status ${response.status()}: ${await response.text()}`).toBeTruthy();
                await expect(page).toHaveURL(/student-details\/\d+/i);
                await page.reload();
                const idLabel = page.getByRole('heading', { name: new RegExp(data.lastName) }).locator('xpath=following-sibling::p[1]');
                await expect(idLabel).toHaveText(/\S+/);
                ids.push(((await idLabel.textContent()) ?? '').trim());
            }

            expect(ids[0]).toMatch(/\S+/);
            expect(ids[1]).toMatch(/\S+/);
            expect(ids[0]).not.toEqual(ids[1]);
        });
    });
});

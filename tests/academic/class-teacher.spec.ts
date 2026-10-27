import { Browser } from '@playwright/test';
import { authenticatedTest as test, expect } from '../fixtures';
import { createClass } from '../helpers/classes';
import { signIn, signInAndSetPassword } from '../helpers/session';
import { ClassDetailsPage } from '../pages/ClassDetailsPage';
import { ClassPage } from '../pages/ClassPage';
import { StaffPage } from '../pages/StaffPage';
import { makeStaff } from '../data/people';

/**
 * Assigning a teacher to a class. The class teacher is shown on the class page, and is the person
 * who finds the class under "My Classes" (attendance and grading start there). Changing the class
 * teacher has to move all of that: the new teacher gets the class, the old one loses it.
 */
const PASSWORD = 'Newpass#12345';
const tag = Date.now().toString(36);
// neither name may contain the other: rows are found by text, so overlapping names pick the wrong row
const classWithTeacher = `Staffed Class ${tag}`;
const classWithout = `Vacant Class ${tag}`;
const first = makeStaff({ employeeType: 'Teacher' });
const second = makeStaff({ employeeType: 'Teacher' });
const nameOf = (t: { firstName: string; lastName: string }) => `${t.firstName} ${t.lastName}`;

const ids = { withTeacher: 0, without: 0 };

/** Signs in as the teacher and opens My Classes. */
async function myClasses(browser: Browser, teacher: typeof first) {
    const session = await signIn(browser, teacher.email, PASSWORD);
    await session.page.waitForURL(/\/dashboard/);
    await session.page.goto('/academic/my-classes');
    await expect(session.page.getByRole('heading', { name: 'My Classes' }).first()).toBeVisible();
    await session.page.waitForLoadState('networkidle');
    return { ...session, content: session.page.locator('.page-wrapper') };
}

test.describe.serial('Class teacher', () => {
    test('sets up two teachers, a class with a teacher, and a class without one', async ({ page, browser }) => {
        test.setTimeout(120_000);
        const staffPage = new StaffPage(page);
        for (const teacher of [first, second]) {
            await staffPage.visitAddForm();
            await staffPage.fillStaffForm(teacher);
            const [res] = await Promise.all([
                page.waitForResponse(r => r.url().includes('/employees') && r.request().method() === 'POST'),
                staffPage.submitForm(),
            ]);
            expect(res.ok(), `status ${res.status()}`).toBeTruthy();
        }

        ids.withTeacher = await createClass(page, classWithTeacher, 'ACTIVE', nameOf(first));
        ids.without = await createClass(page, classWithout);

        // first logins force a password change; do them once so the tests below just sign in
        await (await signInAndSetPassword(browser, first.email, PASSWORD)).close();
        await (await signInAndSetPassword(browser, second.email, PASSWORD)).close();
    });

    test('the class page shows the class teacher and their employee code', async ({ page }) => {
        const details = new ClassDetailsPage(page);
        await details.visit(ids.withTeacher);

        await expect(details.classTeachers).toHaveCount(1);
        await expect(details.classTeachers.first()).toHaveText(nameOf(first));
        await expect(page.locator('.card').filter({ has: page.getByRole('heading', { name: 'Class Teacher' }) }).locator('p.text-primary'))
            .toHaveText(/\S+/);
    });

    test('a class created without a teacher shows no class teacher', async ({ page }) => {
        const details = new ClassDetailsPage(page);
        await details.visit(ids.without);

        await expect(details.classTeachers).toHaveCount(0);
    });

    test('the class teacher finds the class under My Classes, a teacher of no class does not', async ({ browser }) => {
        const mine = await myClasses(browser, first);
        await expect(mine.content.getByText(classWithTeacher)).toBeVisible();
        await expect(mine.content.getByText(classWithout)).toHaveCount(0);
        await mine.close();

        const other = await myClasses(browser, second);
        await expect(other.content.getByText(classWithTeacher)).toHaveCount(0);
        await other.close();
    });

    test('changing the class teacher shows the new teacher on the class page', async ({ page }) => {
        const classPage = new ClassPage(page);
        await classPage.visit();
        await classPage.search(classWithTeacher);
        await classPage.clickEditInRow(classWithTeacher);
        await classPage.expectDialogVisible('Edit');

        await classPage.selectTeacher(nameOf(second));
        const [response] = await Promise.all([
            page.waitForResponse(r => /\/classes\/\d+$/.test(r.url()) && r.request().method() !== 'GET'),
            classPage.submitForm(),
        ]);
        expect(response.ok(), `status ${response.status()}`).toBeTruthy();

        const details = new ClassDetailsPage(page);
        await details.visit(ids.withTeacher);
        await expect(details.classTeachers).toHaveCount(1);
        await expect(details.classTeachers.first()).toHaveText(nameOf(second));
    });

    test('after the change, the new teacher has the class and the old one has lost it', async ({ browser }) => {
        const newTeacher = await myClasses(browser, second);
        await expect(newTeacher.content.getByText(classWithTeacher)).toBeVisible();
        await newTeacher.close();

        const oldTeacher = await myClasses(browser, first);
        await expect(oldTeacher.content.getByText(classWithTeacher)).toHaveCount(0);
        await oldTeacher.close();
    });

    test('giving the teacherless class a teacher puts it on that teacher\'s My Classes', async ({ page, browser }) => {
        const classPage = new ClassPage(page);
        await classPage.visit();
        await classPage.search(classWithout);
        await classPage.clickEditInRow(classWithout);
        await classPage.expectDialogVisible('Edit');
        await classPage.selectTeacher(nameOf(first));
        const [response] = await Promise.all([
            page.waitForResponse(r => /\/classes\/\d+$/.test(r.url()) && r.request().method() !== 'GET'),
            classPage.submitForm(),
        ]);
        expect(response.ok(), `status ${response.status()}`).toBeTruthy();

        const details = new ClassDetailsPage(page);
        await details.visit(ids.without);
        await expect(details.classTeachers.first()).toHaveText(nameOf(first));

        const mine = await myClasses(browser, first);
        await expect(mine.content.getByText(classWithout)).toBeVisible();
        await mine.close();
    });
});

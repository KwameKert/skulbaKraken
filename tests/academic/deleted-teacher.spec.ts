import { Page } from '@playwright/test';
import { authenticatedTest as test, expect } from '../fixtures';
import { createClass } from '../helpers/classes';
import { createChild, enrol } from '../helpers/students';
import { ClassDetailsPage } from '../pages/ClassDetailsPage';
import { ClassPage } from '../pages/ClassPage';
import { CoursePage } from '../pages/CoursePage';
import { StaffPage } from '../pages/StaffPage';
import { makeGuardian, makeStaff, makeStudent } from '../data/people';

/**
 * Deleting a teacher who still teaches. The rule: a teacher who is a class teacher or a course
 * teacher cannot be deleted until those classes and courses are given to someone else. Deleting
 * someone with no assignments works as before, and a deleted person is never offered as a teacher.
 *
 * Each scenario has its own teacher, class and course, so one scenario deleting someone (which is
 * what happens until the rule exists) cannot disturb the next.
 */
const tag = Date.now().toString(36);
const nameOf = (t: { firstName: string; lastName: string }) => `${t.firstName} ${t.lastName}`;
const replacement = makeStaff({ employeeType: 'Teacher' });

interface Teaching {
    teacher: ReturnType<typeof makeStaff>;
    className: string;
    courseName: string;
    classId: number;
}

async function createTeacher(page: Page, teacher: ReturnType<typeof makeStaff>) {
    const staffPage = new StaffPage(page);
    await staffPage.visitAddForm();
    await staffPage.fillStaffForm(teacher);
    const [res] = await Promise.all([
        page.waitForResponse(r => r.url().includes('/employees') && r.request().method() === 'POST'),
        staffPage.submitForm(),
    ]);
    expect(res.ok(), `create ${teacher.lastName}: status ${res.status()}`).toBeTruthy();
}

/** A teacher who is the class teacher of a class and the teacher of a course assigned to that class. */
async function teacherWithWork(page: Page, label: string): Promise<Teaching> {
    const teacher = makeStaff({ employeeType: 'Teacher' });
    await createTeacher(page, teacher);
    const className = `${label} Class ${tag}`;
    const courseName = `${label} Course ${tag}`;
    const classId = await createClass(page, className, 'ACTIVE', nameOf(teacher));
    const course = await new CoursePage(page).createCourse({ name: courseName, courseId: `${label.slice(0, 3)}${tag}`, teacherName: nameOf(teacher) });
    expect(course.ok(), `create course: status ${course.status()}`).toBeTruthy();
    const details = new ClassDetailsPage(page);
    await details.visit(classId);
    await details.openCoursesTab();
    expect((await details.assignCourse({ courseName, periods: 3 })).ok()).toBeTruthy();
    return { teacher, className, courseName, classId };
}

async function reassignClassTeacher(page: Page, className: string, to: typeof replacement) {
    const classPage = new ClassPage(page);
    await classPage.visit();
    await classPage.search(className);
    await classPage.clickEditInRow(className);
    await classPage.expectDialogVisible('Edit');
    await classPage.selectTeacher(nameOf(to));
    const [response] = await Promise.all([
        page.waitForResponse(r => /\/classes\/\d+$/.test(r.url()) && r.request().method() !== 'GET'),
        classPage.submitForm(),
    ]);
    expect(response.ok(), `reassign class teacher: status ${response.status()}`).toBeTruthy();
}

/** Deletes a staff member from the staff list and resolves with the API response. */
async function deleteStaff(page: Page, person: { firstName: string; lastName: string }) {
    const staffPage = new StaffPage(page);
    await staffPage.visit();
    await staffPage.search(person.lastName);
    await expect(staffPage.rowByName(nameOf(person))).toBeVisible();
    await staffPage.clickDeleteInRow(nameOf(person));
    const [response] = await Promise.all([
        page.waitForResponse(r => r.url().includes('/employees') && r.request().method() === 'DELETE'),
        staffPage.confirmSwal(),
    ]);
    return { staffPage, response };
}

async function expectStillListed(page: Page, person: { firstName: string; lastName: string }) {
    const staffPage = new StaffPage(page);
    await staffPage.visit();
    await staffPage.search(person.lastName);
    await expect(staffPage.rowByName(nameOf(person))).toBeVisible();
}

async function expectRefused(page: Page, response: import('@playwright/test').Response, mentions: RegExp) {
    expect(response.status(), await response.text()).toBeGreaterThanOrEqual(400);
    expect(response.status()).toBeLessThan(500);
    const message = page.locator('.p-toast-message-error, .swal2-popup').first();
    await expect(message).toBeVisible();
    expect(await message.innerText()).toMatch(mentions);
}

test.describe.serial('Deleting a teacher who still teaches', () => {
    const work: Record<'alpha' | 'bravo' | 'charlie', Teaching> = {} as never;

    test('sets up three teachers with a class and a course each, and a replacement', async ({ page }) => {
        test.setTimeout(240_000);
        await createTeacher(page, replacement);
        work.alpha = await teacherWithWork(page, 'Alpha');
        work.bravo = await teacherWithWork(page, 'Bravo');
        work.charlie = await teacherWithWork(page, 'Charlie');
    });

    test('a teacher with a class and a course cannot be deleted, and the admin is told why', async ({ page }) => {
        const { alpha } = work;

        const { response } = await deleteStaff(page, alpha.teacher);

        await expectRefused(page, response, /class|course/i);
        await expectStillListed(page, alpha.teacher);
        const details = new ClassDetailsPage(page);
        await details.visit(alpha.classId);
        await expect(details.classTeachers).toHaveText([nameOf(alpha.teacher)]);
    });

    test('giving away only the class is not enough: the courses still block the delete', async ({ page }) => {
        const { bravo } = work;
        await reassignClassTeacher(page, bravo.className, replacement);

        const { response } = await deleteStaff(page, bravo.teacher);

        await expectRefused(page, response, /course/i);
        await expectStillListed(page, bravo.teacher);
    });

    test('once the class and the course have a new teacher, the delete goes through', async ({ page }) => {
        const { charlie } = work;
        await reassignClassTeacher(page, charlie.className, replacement);
        const courseChange = await new CoursePage(page).changeTeacher(charlie.courseName, nameOf(replacement));
        expect(courseChange.ok(), `status ${courseChange.status()}`).toBeTruthy();

        const { staffPage, response } = await deleteStaff(page, charlie.teacher);

        expect(response.ok(), `status ${response.status()}: ${await response.text()}`).toBeTruthy();
        await staffPage.visit();
        await staffPage.search(charlie.teacher.lastName);
        await expect(staffPage.rowByName(nameOf(charlie.teacher))).toHaveCount(0);
    });

    test('after that, the class and its course show the replacement and no one who left', async ({ page }) => {
        const { charlie } = work;
        const details = new ClassDetailsPage(page);

        await details.visit(charlie.classId);
        await expect(details.classTeachers).toHaveText([nameOf(replacement)]);
        await details.openCoursesTab();
        await expect(details.cardFor(charlie.courseName)).toContainText(nameOf(replacement));
        await expect(details.cardFor(charlie.courseName)).not.toContainText(charlie.teacher.lastName);
    });

    test('a student in that class sees the replacement as the course teacher', async ({ page }) => {
        const { charlie } = work;
        const studentId = await createChild(page, makeStudent(), makeGuardian({ isPrimary: true }));
        await enrol(page, studentId, charlie.className);

        await page.goto(`/peoples/students/student-details/${studentId}/academics/courses`);
        await page.waitForLoadState('networkidle');
        const row = page.locator('.page-wrapper table tbody tr').filter({ hasText: charlie.courseName });

        await expect(row).toHaveCount(1);
        await expect(row).toContainText(nameOf(replacement));
        await expect(row).not.toContainText(charlie.teacher.lastName);
    });

    test('a deleted teacher is not offered as a new class teacher or course teacher', async ({ page }) => {
        // uses a separate teacher with no assignments, so the answer does not depend on the rule above
        const gone = makeStaff({ employeeType: 'Teacher' });
        await createTeacher(page, gone);
        const removal = await deleteStaff(page, gone);
        expect(removal.response.ok(), `status ${removal.response.status()}`).toBeTruthy();

        const classPage = new ClassPage(page);
        await classPage.visit();
        await classPage.clickAddClass();
        await page.locator('ng-select[formcontrolname="teacherId"]').click();
        await page.locator('.ng-option').first().waitFor();
        const classOptions = await page.locator('.ng-option').allTextContents();
        expect(classOptions.some(o => o.includes(gone.lastName)), 'deleted teacher offered as class teacher').toBeFalsy();
        expect(classOptions.some(o => o.includes(replacement.lastName)), 'active teacher is offered').toBeTruthy();
        await page.keyboard.press('Escape');
        await classPage.cancelDialog();

        await page.goto('/academic/courses');
        await page.locator('table.datatable').waitFor();
        await page.locator('a.btn-primary').filter({ hasText: /add course/i }).click();
        await page.locator('mat-dialog-container ng-select[formcontrolname="teacherId"]').click();
        await page.locator('.ng-option').first().waitFor();
        const courseOptions = await page.locator('.ng-option').allTextContents();
        expect(courseOptions.some(o => o.includes(gone.lastName)), 'deleted teacher offered as course teacher').toBeFalsy();
        expect(courseOptions.some(o => o.includes(replacement.lastName)), 'active teacher is offered').toBeTruthy();
    });
});

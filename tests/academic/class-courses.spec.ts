import { Browser, Page } from '@playwright/test';
import { authenticatedTest as test, expect } from '../fixtures';
import { ApiSession, openApiSession } from '../helpers/api';
import { createClass } from '../helpers/classes';
import { signIn, signInAndSetPassword } from '../helpers/session';
import { createChild, enrol } from '../helpers/students';
import { ClassDetailsPage } from '../pages/ClassDetailsPage';
import { CoursePage } from '../pages/CoursePage';
import { StaffPage } from '../pages/StaffPage';
import { makeGuardian, makeStaff, makeStudent } from '../data/people';

/**
 * Assigning courses to a class. The class page's "Course Assigned" tab is the source of truth, and
 * the assignment has to reach everyone it affects:
 *  - students enrolled in the class see the course, including courses assigned after they enrolled
 *  - the course's own teacher finds it under "My Courses"
 *  - assigning the same course twice never duplicates it, and a deleted assignment can come back
 *
 * Each run makes its own teachers, courses, classes and students.
 */
const PASSWORD = 'Newpass#12345';
const tag = Date.now().toString(36);
// course names must not contain one another: cards and rows are found by text
const maths = `Algebra ${tag}`;
const english = `Grammar ${tag}`;
const science = `Physics ${tag}`;
const classA = `Course Class A ${tag}`;
const classB = `Course Class B ${tag}`;
const mathsTeacher = makeStaff({ employeeType: 'Teacher' });
const englishTeacher = makeStaff({ employeeType: 'Teacher' });
const student = makeStudent();
const otherStudent = makeStudent();
const guardian = makeGuardian({ isPrimary: true });
const otherGuardian = makeGuardian({ isPrimary: true });
const nameOf = (t: { firstName: string; lastName: string }) => `${t.firstName} ${t.lastName}`;

const ids = { classA: 0, classB: 0, student: 0, otherStudent: 0, mathsAssignment: 0, scienceAssignment: 0 };
let assignPayload: Record<string, unknown> = {};

async function studentCourses(page: Page, studentId: number) {
    await page.goto(`/peoples/students/student-details/${studentId}/academics/courses`);
    await expect(page.getByText('Courses Assigned').first()).toBeVisible();
    await page.waitForLoadState('networkidle');
    return page.locator('.page-wrapper table tbody tr');
}

async function asCourseTeacher(browser: Browser, teacher: typeof mathsTeacher) {
    const session = await signIn(browser, teacher.email, PASSWORD);
    await session.page.waitForURL(/\/dashboard/);
    await session.page.goto('/academic/my-courses');
    await expect(session.page.getByRole('heading', { name: 'My Courses' }).first()).toBeVisible();
    await session.page.waitForLoadState('networkidle');
    return { ...session, content: session.page.locator('.page-wrapper') };
}

test.describe.serial('Course assignment', () => {
    test('sets up teachers, courses, two classes and two students', async ({ page, browser }) => {
        test.setTimeout(240_000);
        const staffPage = new StaffPage(page);
        for (const teacher of [mathsTeacher, englishTeacher]) {
            await staffPage.visitAddForm();
            await staffPage.fillStaffForm(teacher);
            const [res] = await Promise.all([
                page.waitForResponse(r => r.url().includes('/employees') && r.request().method() === 'POST'),
                staffPage.submitForm(),
            ]);
            expect(res.ok(), `status ${res.status()}`).toBeTruthy();
        }

        const courses = new CoursePage(page);
        for (const [name, teacher] of [[maths, mathsTeacher], [english, englishTeacher], [science, mathsTeacher]] as const) {
            const res = await courses.createCourse({ name, courseId: `${name.slice(0, 4)}${tag}`, teacherName: nameOf(teacher) });
            expect(res.ok(), `create course ${name}: status ${res.status()}`).toBeTruthy();
        }

        ids.classA = await createClass(page, classA);
        ids.classB = await createClass(page, classB);
        ids.student = await createChild(page, student, guardian);
        ids.otherStudent = await createChild(page, otherStudent, otherGuardian);
        await enrol(page, ids.otherStudent, classB);

        // first logins force a password change; do them once so the tests below just sign in
        for (const username of [mathsTeacher.email, englishTeacher.email, guardian.phoneNumber]) {
            await (await signInAndSetPassword(browser, username, PASSWORD)).close();
        }
    });

    test('a class with no courses says so', async ({ page }) => {
        const details = new ClassDetailsPage(page);
        await details.visit(ids.classA);
        await details.openCoursesTab();

        await details.expectNoCourses();
    });

    test('Create stays disabled until a course and the periods are filled, and Cancel assigns nothing', async ({ page }) => {
        const details = new ClassDetailsPage(page);
        await details.visit(ids.classA);
        await details.openCoursesTab();

        await details.openAssignDialog();
        await expect(details.dialogSubmit).toBeDisabled();
        await details.fillAssignment({ courseName: maths });
        await expect(details.dialogSubmit).toBeDisabled();
        await details.fillAssignment({ periods: 4, status: 'Active' });
        await expect(details.dialogSubmit).toBeEnabled();
        await details.cancelDialog();

        await details.expectNoCourses();
    });

    test('an assigned course shows its term, its teacher, the periods and Active, and survives a reload', async ({ page }) => {
        const details = new ClassDetailsPage(page);
        await details.visit(ids.classA);
        await details.openCoursesTab();

        await details.openAssignDialog();
        await details.fillAssignment({ courseName: maths, periods: 4, status: 'Active' });
        const response = await details.submitAssignment('POST');
        expect(response.ok(), `status ${response.status()}: ${await response.text()}`).toBeTruthy();
        assignPayload = response.request().postDataJSON();
        ids.mathsAssignment = (await response.json()).data.id;
        const termName: string = (await response.json()).data.termName;

        const card = details.cardFor(maths);
        await expect(card).toHaveCount(1);
        await expect(card).toContainText(termName);
        await expect(card).toContainText(nameOf(mathsTeacher));
        await expect(card).toContainText('4 periods');
        await expect(card).toContainText('ACTIVE');

        await details.visit(ids.classA);
        await details.openCoursesTab();
        await expect(details.cardFor(maths)).toHaveCount(1);
    });

    test('assigning the same course again does not add a second card', async ({ page }) => {
        const details = new ClassDetailsPage(page);
        await details.visit(ids.classA);
        await details.openCoursesTab();

        const response = await details.assignCourse({ courseName: maths, periods: 4 });

        expect(response.ok(), `status ${response.status()}`).toBeTruthy();
        expect((await response.json()).data.id).toBe(ids.mathsAssignment);
        await details.visit(ids.classA);
        await details.openCoursesTab();
        await expect(details.courseCards).toHaveCount(1);
    });

    test('a second course sits beside the first, each with its own teacher', async ({ page }) => {
        const details = new ClassDetailsPage(page);
        await details.visit(ids.classA);
        await details.openCoursesTab();

        const response = await details.assignCourse({ courseName: english, periods: 3 });

        expect(response.ok(), `status ${response.status()}`).toBeTruthy();
        await expect(details.courseCards).toHaveCount(2);
        await expect(details.cardFor(maths)).toContainText(nameOf(mathsTeacher));
        await expect(details.cardFor(english)).toContainText(nameOf(englishTeacher));
        await expect(details.cardFor(english)).toContainText('3 periods');
    });

    test('editing the number of periods updates the card', async ({ page }) => {
        const details = new ClassDetailsPage(page);
        await details.visit(ids.classA);
        await details.openCoursesTab();

        await details.openEditAssignment(maths);
        await details.fillAssignment({ periods: 6 });
        const response = await details.submitAssignment('PUT');

        expect(response.ok(), `status ${response.status()}`).toBeTruthy();
        await expect(details.cardFor(maths)).toContainText('6 periods');
        await details.visit(ids.classA);
        await details.openCoursesTab();
        await expect(details.cardFor(maths)).toContainText('6 periods');
        await expect(details.cardFor(english)).toContainText('3 periods');
    });

    test('marking an assignment Inactive shows it as inactive, and Active brings it back', async ({ page }) => {
        const details = new ClassDetailsPage(page);
        await details.visit(ids.classA);
        await details.openCoursesTab();

        await details.openEditAssignment(english);
        await details.fillAssignment({ status: 'Inactive' });
        expect((await details.submitAssignment('PUT')).ok()).toBeTruthy();
        await expect(details.cardFor(english)).toContainText('INACTIVE');

        await details.openEditAssignment(english);
        await details.fillAssignment({ status: 'Active' });
        expect((await details.submitAssignment('PUT')).ok()).toBeTruthy();
        await expect(details.cardFor(english)).toContainText('ACTIVE');
        await expect(details.cardFor(english)).not.toContainText('INACTIVE');
    });

    test('a student enrolled afterwards sees every course assigned to the class', async ({ page }) => {
        await enrol(page, ids.student, classA);

        const rows = await studentCourses(page, ids.student);

        await expect(rows.filter({ hasText: maths })).toHaveCount(1);
        await expect(rows.filter({ hasText: english })).toHaveCount(1);
        await expect(rows.filter({ hasText: maths })).toContainText(nameOf(mathsTeacher));
    });

    test('a course assigned after the student enrolled reaches them too', async ({ page }) => {
        const details = new ClassDetailsPage(page);
        await details.visit(ids.classA);
        await details.openCoursesTab();
        const response = await details.assignCourse({ courseName: science, periods: 2 });
        expect(response.ok(), `status ${response.status()}`).toBeTruthy();
        ids.scienceAssignment = (await response.json()).data.id;

        const rows = await studentCourses(page, ids.student);

        await expect(rows.filter({ hasText: science })).toHaveCount(1);
        await expect(rows).toHaveCount(3);
    });

    test('a student in the other class sees none of them, and that class lists none', async ({ page }) => {
        const rows = await studentCourses(page, ids.otherStudent);
        for (const course of [maths, english, science]) {
            await expect(rows.filter({ hasText: course })).toHaveCount(0);
        }

        const details = new ClassDetailsPage(page);
        await details.visit(ids.classB);
        await details.openCoursesTab();
        await details.expectNoCourses();
    });

    test('the course teacher finds their courses under My Courses, and only theirs', async ({ browser }) => {
        const maths_ = await asCourseTeacher(browser, mathsTeacher);
        await expect(maths_.content.getByText(maths)).toBeVisible();
        await expect(maths_.content.getByText(science)).toBeVisible();
        await expect(maths_.content.getByText(english)).toHaveCount(0);
        await maths_.close();

        const english_ = await asCourseTeacher(browser, englishTeacher);
        await expect(english_.content.getByText(english)).toBeVisible();
        await expect(english_.content.getByText(maths)).toHaveCount(0);
        await english_.close();
    });

    test('cancelling the delete keeps the course', async ({ page }) => {
        const details = new ClassDetailsPage(page);
        await details.visit(ids.classA);
        await details.openCoursesTab();

        await details.startDelete(science);
        await details.cancelDelete();

        await expect(details.cardFor(science)).toHaveCount(1);
    });

    test('deleting an assignment removes the card', async ({ page }) => {
        const details = new ClassDetailsPage(page);
        await details.visit(ids.classA);
        await details.openCoursesTab();

        await details.startDelete(science);
        const response = await details.confirmDelete();

        expect(response.ok(), `status ${response.status()}`).toBeTruthy();
        await expect(details.cardFor(science)).toHaveCount(0);
        await details.visit(ids.classA);
        await details.openCoursesTab();
        await expect(details.cardFor(science)).toHaveCount(0);
        await expect(details.courseCards).toHaveCount(2);
    });

    test('a deleted assignment disappears from the enrolled student\'s courses', async ({ page }) => {
        const rows = await studentCourses(page, ids.student);

        await expect(rows.filter({ hasText: science })).toHaveCount(0);
        await expect(rows.filter({ hasText: maths })).toHaveCount(1);
    });

    test('deleting a course assignment confirms it in terms of the course', async ({ page }) => {
        const details = new ClassDetailsPage(page);
        await details.visit(ids.classA);
        await details.openCoursesTab();

        await details.startDelete(english);
        await details.confirmDelete();

        // wait for the message to exist first, otherwise "no toast says 'class'" is true before any toast appears
        const toast = page.locator('.p-toast-message').filter({ hasText: /unassigned successfully/i });
        await expect(toast).toBeVisible();
        await expect(toast).toContainText(/course/i);
        await expect(toast).not.toContainText(/class/i);
    });

    test('Synchronise on a course confirms it as a course, not a class', async ({ page }) => {
        const details = new ClassDetailsPage(page);
        await details.visit(ids.classA);
        await details.openCoursesTab();

        const response = await details.synchronise(maths);

        expect(response.ok(), `status ${response.status()}`).toBeTruthy();
        const toast = page.locator('.p-toast-message').filter({ hasText: /synchronised successfully/i });
        await expect(toast).toBeVisible();
        const message = await toast.innerText();
        expect(message).not.toMatch(/class synchronised/i);
    });

    test('a failed unassign shows one error message, about the course', async ({ page }) => {
        const details = new ClassDetailsPage(page);
        await details.visit(ids.classA);
        await details.openCoursesTab();
        // a real failure is hard to provoke from the UI, so the server's answer is faked for this one request
        await page.route(/assign-courses\/\d+$/, route => route.request().method() === 'DELETE'
            ? route.fulfill({ status: 500, contentType: 'application/json', body: JSON.stringify({ message: 'boom', status: 'INTERNAL_SERVER_ERROR', data: null }) })
            : route.continue());

        await details.startDelete(maths);
        await details.confirmDelete();

        const errors = page.locator('.p-toast-message-error');
        await expect(errors.filter({ hasText: /unassign course/i })).toBeVisible();
        const messages = (await errors.allInnerTexts()).map(m => m.replace(/\s+/g, ' '));
        expect(messages, 'error messages shown').toHaveLength(1);
        expect(messages.join(' ')).not.toMatch(/class/i);
        await page.unroute(/assign-courses\/\d+$/);
        await expect(details.cardFor(maths)).toHaveCount(1);
    });

    test('assigning a deleted course again brings it back on the same record', async ({ page }) => {
        const details = new ClassDetailsPage(page);
        await details.visit(ids.classA);
        await details.openCoursesTab();

        const response = await details.assignCourse({ courseName: science, periods: 2 });

        expect(response.ok(), `status ${response.status()}`).toBeTruthy();
        expect((await response.json()).data.id).toBe(ids.scienceAssignment);
        await expect(details.cardFor(science)).toHaveCount(1);
    });

    for (const who of ['parent', 'teacher'] as const) {
        test(`a ${who} cannot assign, edit or delete course assignments`, async ({ browser }) => {
            const open = (): Promise<ApiSession> =>
                who === 'parent'
                    ? openApiSession(browser, guardian.phoneNumber, PASSWORD)
                    : openApiSession(browser, mathsTeacher.email, PASSWORD);
            const s = await open();
            const base = `${s.academics}/classes/assign-courses`;
            const results = {
                assign: await s.send('POST', base, assignPayload),
                edit: await s.send('PUT', `${base}/${ids.mathsAssignment}`, { ...assignPayload, numOfPeriod: 1 }),
                remove: await s.send('DELETE', `${base}/${ids.mathsAssignment}`),
            };
            await s.close();

            for (const [name, r] of Object.entries(results)) {
                expect([401, 403], `${name}: ${r.body.slice(0, 200)}`).toContain(r.status);
            }
        });
    }

    test('nothing was changed by those attempts: Algebra is still assigned with six periods', async ({ page }) => {
        const details = new ClassDetailsPage(page);
        await details.visit(ids.classA);
        await details.openCoursesTab();

        await expect(details.cardFor(maths)).toHaveCount(1);
        await expect(details.cardFor(maths)).toContainText('6 periods');
        await expect(details.cardFor(maths)).toContainText('ACTIVE');
    });
});

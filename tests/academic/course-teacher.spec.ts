import { Browser } from '@playwright/test';
import { authenticatedTest as test, expect } from '../fixtures';
import { createClass } from '../helpers/classes';
import { signIn, signInAndSetPassword } from '../helpers/session';
import { createChild, enrol } from '../helpers/students';
import { ClassDetailsPage } from '../pages/ClassDetailsPage';
import { CoursePage } from '../pages/CoursePage';
import { StaffPage } from '../pages/StaffPage';
import { makeGuardian, makeStaff, makeStudent } from '../data/people';

/**
 * A course belongs to a teacher, and the course shows up in several places: the Courses list, the
 * class page's course cards, the enrolled students' course lists, and the teacher's My Courses.
 * Changing the course's teacher or name must reach all of them, without duplicating anything.
 */
const PASSWORD = 'Newpass#12345';
const tag = Date.now().toString(36);
const className = `Rotation Class ${tag}`;
const courseName = `Botany ${tag}`;
const renamed = `Zoology ${tag}`;
const first = makeStaff({ employeeType: 'Teacher' });
const second = makeStaff({ employeeType: 'Teacher' });
const nameOf = (t: { firstName: string; lastName: string }) => `${t.firstName} ${t.lastName}`;

const ids = { class: 0, student: 0 };

async function myCourses(browser: Browser, teacher: typeof first) {
    const session = await signIn(browser, teacher.email, PASSWORD);
    await session.page.waitForURL(/\/dashboard/);
    await session.page.goto('/academic/my-courses');
    await expect(session.page.getByRole('heading', { name: 'My Courses' }).first()).toBeVisible();
    await session.page.waitForLoadState('networkidle');
    return { ...session, content: session.page.locator('.page-wrapper') };
}

test.describe.serial('Changing a course\'s teacher or name', () => {
    test('sets up two teachers, a course assigned to a class, and an enrolled student', async ({ page, browser }) => {
        test.setTimeout(180_000);
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

        const course = await new CoursePage(page).createCourse({ name: courseName, courseId: `BO${tag}`, teacherName: nameOf(first) });
        expect(course.ok(), `status ${course.status()}`).toBeTruthy();
        ids.class = await createClass(page, className);
        const details = new ClassDetailsPage(page);
        await details.visit(ids.class);
        await details.openCoursesTab();
        expect((await details.assignCourse({ courseName, periods: 5 })).ok()).toBeTruthy();
        ids.student = await createChild(page, makeStudent(), makeGuardian({ isPrimary: true }));
        await enrol(page, ids.student, className);

        for (const teacher of [first, second]) {
            await (await signInAndSetPassword(browser, teacher.email, PASSWORD)).close();
        }
    });

    test('the first teacher has the course under My Courses, the second does not', async ({ browser }) => {
        const mine = await myCourses(browser, first);
        await expect(mine.content.getByText(courseName)).toBeVisible();
        await mine.close();

        const other = await myCourses(browser, second);
        await expect(other.content.getByText(courseName)).toHaveCount(0);
        await other.close();
    });

    test('changing the course teacher updates the Courses list', async ({ page }) => {
        const courses = new CoursePage(page);

        const response = await courses.changeTeacher(courseName, nameOf(second));

        expect(response.ok(), `status ${response.status()}: ${await response.text()}`).toBeTruthy();
        await courses.findCourse(courseName);
        await expect(courses.rowFor(courseName)).toContainText(nameOf(second));
        await expect(courses.rowFor(courseName)).not.toContainText(first.lastName);
    });

    test('the class page shows the new teacher on the same card, with the same periods', async ({ page }) => {
        const details = new ClassDetailsPage(page);
        await details.visit(ids.class);
        await details.openCoursesTab();

        await expect(details.courseCards).toHaveCount(1);
        await expect(details.cardFor(courseName)).toContainText(nameOf(second));
        await expect(details.cardFor(courseName)).not.toContainText(first.lastName);
        await expect(details.cardFor(courseName)).toContainText('5 periods');
    });

    test('the enrolled student sees the new teacher', async ({ page }) => {
        await page.goto(`/peoples/students/student-details/${ids.student}/academics/courses`);
        await page.waitForLoadState('networkidle');
        const row = page.locator('.page-wrapper table tbody tr').filter({ hasText: courseName });

        await expect(row).toHaveCount(1);
        await expect(row).toContainText(nameOf(second));
        await expect(row).not.toContainText(first.lastName);
    });

    test('the course moves from the first teacher\'s My Courses to the second\'s', async ({ browser }) => {
        const gone = await myCourses(browser, first);
        await expect(gone.content.getByText(courseName)).toHaveCount(0);
        await gone.close();

        const gained = await myCourses(browser, second);
        await expect(gained.content.getByText(courseName)).toBeVisible();
        await gained.close();
    });

    test('renaming the course shows the new name on the class page and the student\'s list', async ({ page }) => {
        const response = await new CoursePage(page).editCourse(courseName, { name: renamed });
        expect(response.ok(), `status ${response.status()}`).toBeTruthy();

        const details = new ClassDetailsPage(page);
        await details.visit(ids.class);
        await details.openCoursesTab();
        await expect(details.courseCards).toHaveCount(1);
        await expect(details.cardFor(renamed)).toHaveCount(1);
        await expect(details.cardFor(courseName)).toHaveCount(0);

        await page.goto(`/peoples/students/student-details/${ids.student}/academics/courses`);
        await page.waitForLoadState('networkidle');
        const rows = page.locator('.page-wrapper table tbody tr');
        await expect(rows.filter({ hasText: renamed })).toHaveCount(1);
        await expect(rows.filter({ hasText: courseName })).toHaveCount(0);
    });
});

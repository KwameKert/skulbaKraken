import { authenticatedTest as test, expect } from '../fixtures';
import { CoursePage } from '../pages/CoursePage';
import { StaffPage } from '../pages/StaffPage';
import { makeStaff } from '../data/people';

/** The Courses list: finding a course. Courses are created per run with unique names. */
const tag = Date.now().toString(36);
const teacher = makeStaff({ employeeType: 'Teacher' });
const courseName = `Findable ${tag}`;

test.describe.serial('Courses list', () => {
    test('a new course appears in the list with its teacher and status', async ({ page }) => {
        test.setTimeout(90_000);
        const staffPage = new StaffPage(page);
        await staffPage.visitAddForm();
        await staffPage.fillStaffForm(teacher);
        await Promise.all([
            page.waitForResponse(r => r.url().includes('/employees') && r.request().method() === 'POST'),
            staffPage.submitForm(),
        ]);

        const courses = new CoursePage(page);
        const response = await courses.createCourse({ name: courseName, courseId: `FD${tag}`, teacherName: `${teacher.firstName} ${teacher.lastName}` });
        expect(response.ok(), `status ${response.status()}`).toBeTruthy();

        await courses.findCourse(courseName);
        await expect(courses.rowFor(courseName)).toContainText(`${teacher.firstName} ${teacher.lastName}`);
        await expect(courses.rowFor(courseName)).toContainText('ACTIVE');
    });

    test('searching by name finds the course', async ({ page }) => {
        const courses = new CoursePage(page);

        const response = await courses.searchByName(courseName);

        expect(response.status(), await response.text()).toBe(200);
        await expect(courses.rowFor(courseName)).toBeVisible();
        // the name is unique, so the search must narrow the list to exactly that course
        await expect(page.locator('table.datatable tbody tr')).toHaveCount(1);
    });

    test('searching for a name that does not exist shows no courses', async ({ page }) => {
        const courses = new CoursePage(page);

        const response = await courses.searchByName(`Nonexistent ${tag}`);

        expect(response.status(), await response.text()).toBe(200);
        await expect(page.locator('table.datatable tbody tr')).toHaveCount(0);
    });

    test('a partial name finds the course too', async ({ page }) => {
        const courses = new CoursePage(page);

        const response = await courses.searchByName(`Findable`);

        expect(response.status(), await response.text()).toBe(200);
        await expect(courses.rowFor(courseName)).toBeVisible();
    });
});

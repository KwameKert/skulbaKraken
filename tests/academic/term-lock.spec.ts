import { authenticatedTest as test, expect } from '../fixtures';
import { createClass } from '../helpers/classes';
import { ClassDetailsPage } from '../pages/ClassDetailsPage';
import { CoursePage } from '../pages/CoursePage';
import { StaffPage } from '../pages/StaffPage';
import { TermPage } from '../pages/TermPage';
import { makeStaff } from '../data/people';

/**
 * Courses are assigned to a class for one term. A locked, published or inactive term must not accept
 * new assignments: the Assign dialog says so and refuses to save, and the server must refuse too,
 * because the browser is not a guarantee. The test term is Locked and Inactive, in its own date
 * window, and is removed at the end so the shared "current term" is never touched.
 */
const tag = Date.now().toString(36);
const closedTerm = `Closed Term ${tag}`;
const courseName = `Locked Out ${tag}`;
const className = `Term Lock Class ${tag}`;
const teacher = makeStaff({ employeeType: 'Teacher' });

const ids = { class: 0, course: 0, closedTerm: 0 };
let payload: Record<string, unknown> = {};

test.describe.serial('Term lock on course assignment', () => {
    test('sets up a teacher, a course, a class and a closed term', async ({ page }) => {
        test.setTimeout(150_000);
        const staffPage = new StaffPage(page);
        await staffPage.visitAddForm();
        await staffPage.fillStaffForm(teacher);
        await Promise.all([
            page.waitForResponse(r => r.url().includes('/employees') && r.request().method() === 'POST'),
            staffPage.submitForm(),
        ]);
        const course = await new CoursePage(page).createCourse({ name: courseName, courseId: `LO${tag}`, teacherName: `${teacher.firstName} ${teacher.lastName}` });
        expect(course.ok(), `status ${course.status()}`).toBeTruthy();
        ids.course = (await course.json()).data.id;
        ids.class = await createClass(page, className);

        const termPage = new TermPage(page);
        await termPage.visit();
        await termPage.clickAddTerm();
        await termPage.fillForm({
            name: closedTerm,
            academicYearName: '2025/2026 Academic Year',
            startDate: '2026-04-20',
            endDate: '2026-07-20',
            status: 'INACTIVE',
            isLocked: true,
        });
        const [created] = await Promise.all([
            page.waitForResponse(r => /\/terms$/.test(r.url()) && r.request().method() === 'POST'),
            termPage.submitForm(),
        ]);
        expect(created.ok(), `create term: status ${created.status()}: ${await created.text()}`).toBeTruthy();
        ids.closedTerm = (await created.json()).data.id;
    });

    test('control: a course can be assigned in the open term', async ({ page }) => {
        const details = new ClassDetailsPage(page);
        await details.visit(ids.class);
        await details.openCoursesTab();

        const response = await details.assignCourse({ courseName, periods: 3 });

        expect(response.ok(), `status ${response.status()}: ${await response.text()}`).toBeTruthy();
        payload = response.request().postDataJSON();
        expect(payload.termId, 'the open term is not the closed one').not.toBe(ids.closedTerm);
        await expect(details.cardFor(courseName)).toHaveCount(1);
    });

    test('with the closed term selected, the Assign dialog warns and will not save', async ({ page }) => {
        const details = new ClassDetailsPage(page);
        await details.visit(ids.class);
        // the header's term picker decides which term the Course Assigned tab works on
        const picker = page.locator('select').filter({ has: page.locator('option', { hasText: 'Select Term' }) });
        const option = picker.locator('option').filter({ hasText: closedTerm });
        await picker.selectOption(await option.getAttribute('value') as string);
        await details.openCoursesTab();
        await details.expectNoCourses();

        await details.openAssignDialog();

        await expect(page.locator('.p-toast-message').filter({ hasText: /term locked/i })).toBeVisible();
        await expect(page.locator('mat-dialog-container').getByText(/locked, published, or inactive/i)).toBeVisible();
        await details.fillAssignment({ courseName, periods: 3, status: 'Active' });
        await expect(details.dialogSubmit).toBeDisabled();
    });

    test('the server refuses an assignment to a closed term, whatever the browser allows', async ({ page }) => {
        await page.goto('/dashboard');
        const [request] = await Promise.all([
            page.waitForRequest(r => !!r.headers()['authorization'] && /\/academics\/api\//.test(r.url())),
            page.reload(),
        ]);
        const base = `${new URL(request.url()).origin}/academics/api/v1/classes/assign-courses`;

        const response = await page.request.post(base, {
            headers: { Authorization: request.headers()['authorization'] },
            data: { ...payload, termId: ids.closedTerm },
        });

        expect(response.status(), await response.text()).toBeGreaterThanOrEqual(400);
        expect(response.status()).toBeLessThan(500);
    });

    // runs even when a test above fails, so a failed run never leaves a closed term in the term picker
    test.afterAll(async ({ browser }) => {
        const context = await browser.newContext({ storageState: 'playwright/.auth/admin.json' });
        const page = await context.newPage();
        try {
            const termPage = new TermPage(page);
            await termPage.visit();
            await termPage.search(closedTerm);
            await termPage.clickDeleteInRow(closedTerm);
            await Promise.all([
                page.waitForResponse(r => /\/terms\/\d+$/.test(r.url()) && r.request().method() === 'DELETE'),
                termPage.confirmSwalDelete(),
            ]);
        } finally {
            await context.close();
        }
    });
});

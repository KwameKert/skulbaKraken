import { authenticatedTest as test, expect } from '../fixtures';
import { createClass } from '../helpers/classes';
import { EnrollmentPage } from '../pages/EnrollmentPage';
import { StudentsPage } from '../pages/StudentsPage';
import { makeGuardian, makeStudent } from '../data/people';
import { signInAndSetPassword } from '../helpers/session';

/**
 * Enrolling a student in a class. The rules this protects:
 *  - a student has one ACTIVE enrolment at a time; enrolling elsewhere moves them
 *  - enrolling in the same class twice changes nothing
 *  - going back to a class they were in reuses that row instead of adding a duplicate
 *  - the class page, the student page and the parent's dashboard all agree on the class
 *
 * Each run makes its own classes and student, so nothing depends on earlier data.
 */
const tag = Date.now().toString(36);
const classA = `Enrol A ${tag}`;
const classB = `Enrol B ${tag}`;
const classClosed = `Enrol Closed ${tag}`;
const student = makeStudent();
const guardian = makeGuardian({ isPrimary: true });
const PASSWORD = 'Newpass#12345';

const ids = { student: 0, classA: 0, classB: 0 };

test.describe.serial('Enrollment — one student, two classes', () => {
    test('sets up two open classes, a closed one, and a new student', async ({ page }) => {
        test.setTimeout(90_000);
        ids.classA = await createClass(page, classA);
        ids.classB = await createClass(page, classB);
        await createClass(page, classClosed, 'INACTIVE');

        const studentsPage = new StudentsPage(page);
        await studentsPage.visitAddForm();
        await studentsPage.fillStudentForm(student);
        await studentsPage.addGuardian(guardian);
        const [response] = await Promise.all([
            page.waitForResponse(res => res.url().includes('/students') && !res.url().includes('/guardians') && res.request().method() === 'POST'),
            studentsPage.submitForm(),
        ]);
        expect(response.ok(), `status ${response.status()}`).toBeTruthy();
        await expect(page).toHaveURL(/student-details\/(\d+)/i);
        ids.student = Number(page.url().match(/student-details\/(\d+)/)![1]);
    });

    test('a new student starts with no enrollments', async ({ page }) => {
        const enrollment = new EnrollmentPage(page);
        await enrollment.visit(ids.student);

        await enrollment.expectNoEnrollments();
    });

    test('Enroll stays disabled until a class is chosen, and Cancel enrols nobody', async ({ page }) => {
        const enrollment = new EnrollmentPage(page);
        await enrollment.visit(ids.student);

        await enrollment.openDialog();
        await expect(enrollment.dialogEnrollButton).toBeDisabled();
        await enrollment.chooseClass(classA);
        await expect(enrollment.dialogEnrollButton).toBeEnabled();
        await enrollment.cancelDialog();

        await enrollment.visit(ids.student);
        await enrollment.expectNoEnrollments();
    });

    test('enrolling in a class shows an active enrollment for the current year', async ({ page }) => {
        const enrollment = new EnrollmentPage(page);
        await enrollment.visit(ids.student);

        const response = await enrollment.enrollInto(classA);

        expect(response.ok(), `status ${response.status()}: ${await response.text()}`).toBeTruthy();
        await enrollment.expectStatus(classA, 'ACTIVE');
        await expect(enrollment.rows).toHaveCount(1);
        await expect(enrollment.rowForClass(classA)).toContainText(/\d{4}\/\d{4}/);
    });

    test('the enrollment is still there after a reload', async ({ page }) => {
        const enrollment = new EnrollmentPage(page);
        await enrollment.visit(ids.student);

        await enrollment.expectStatus(classA, 'ACTIVE');
    });

    test('the class page lists the student, and the other class does not', async ({ page }) => {
        const enrollment = new EnrollmentPage(page);

        await enrollment.visitClassStudents(ids.classA);
        await expect(enrollment.classStudentRow(student.lastName)).toHaveCount(1);

        await enrollment.visitClassStudents(ids.classB);
        await expect(enrollment.classStudentRow(student.lastName)).toHaveCount(0);
    });

    test('enrolling in the same class again changes nothing', async ({ page }) => {
        const enrollment = new EnrollmentPage(page);
        await enrollment.visit(ids.student);

        const response = await enrollment.enrollInto(classA);

        expect(response.ok(), `status ${response.status()}`).toBeTruthy();
        await enrollment.visit(ids.student);
        await expect(enrollment.rows).toHaveCount(1);
        await enrollment.expectStatus(classA, 'ACTIVE');
    });

    test('enrolling in another class moves the student: new class active, old one inactive', async ({ page }) => {
        const enrollment = new EnrollmentPage(page);
        await enrollment.visit(ids.student);

        const response = await enrollment.enrollInto(classB);

        expect(response.ok(), `status ${response.status()}`).toBeTruthy();
        await expect(enrollment.rows).toHaveCount(2);
        await enrollment.expectStatus(classB, 'ACTIVE');
        await enrollment.expectStatus(classA, 'INACTIVE');
        await expect(enrollment.rows.filter({ hasText: 'ACTIVE' }).filter({ hasNotText: 'INACTIVE' })).toHaveCount(1);
    });

    test('after the move, the old class no longer lists the student and the new one does', async ({ page }) => {
        const enrollment = new EnrollmentPage(page);

        await enrollment.visitClassStudents(ids.classA);
        await expect(enrollment.classStudentRow(student.lastName)).toHaveCount(0);

        await enrollment.visitClassStudents(ids.classB);
        await expect(enrollment.classStudentRow(student.lastName)).toHaveCount(1);
    });

    test('going back to the first class reuses its row instead of adding a duplicate', async ({ page }) => {
        const enrollment = new EnrollmentPage(page);
        await enrollment.visit(ids.student);

        const response = await enrollment.enrollInto(classA);

        expect(response.ok(), `status ${response.status()}`).toBeTruthy();
        await expect(enrollment.rows).toHaveCount(2);
        await enrollment.expectStatus(classA, 'ACTIVE');
        await enrollment.expectStatus(classB, 'INACTIVE');
    });

    test('the parent\'s dashboard shows the class the student is in', async ({ browser }) => {
        test.setTimeout(90_000);
        const parent = await signInAndSetPassword(browser, guardian.phoneNumber, PASSWORD);
        const dropdown = parent.page.locator('.dropdown.my-4');
        await dropdown.locator('a[data-bs-toggle="dropdown"]').click();
        await dropdown.locator('.dropdown-item').filter({ hasText: student.lastName }).click();

        await expect(parent.page.locator('.page-wrapper').getByText(classA)).toBeVisible();
        await parent.close();
    });

    test('a closed class is not offered when enrolling a student', async ({ page }) => {
        const enrollment = new EnrollmentPage(page);
        await enrollment.visit(ids.student);
        await enrollment.openDialog();

        const offered = await enrollment.classOptions();

        expect(offered).toContain(classA);
        expect(offered).not.toContain(classClosed);
    });

    test.describe('withdrawing', () => {
        test('cancelling the confirmation keeps the student enrolled', async ({ page }) => {
            const enrollment = new EnrollmentPage(page);
            await enrollment.visit(ids.student);

            await enrollment.startWithdraw();
            await enrollment.cancelWithdraw();

            await enrollment.visit(ids.student);
            await enrollment.expectStatus(classA, 'ACTIVE');
        });

        test('withdrawing leaves no active enrollment but keeps the history', async ({ page }) => {
            const enrollment = new EnrollmentPage(page);
            await enrollment.visit(ids.student);

            const response = await enrollment.withdraw();

            expect(response.ok(), `status ${response.status()}: ${await response.text()}`).toBeTruthy();
            await expect(enrollment.rows).toHaveCount(2);
            await enrollment.expectStatus(classA, 'INACTIVE');
            await enrollment.expectStatus(classB, 'INACTIVE');
            await enrollment.visit(ids.student);
            await expect(enrollment.rows.filter({ hasText: 'ACTIVE' }).filter({ hasNotText: 'INACTIVE' })).toHaveCount(0);
        });

        test('a withdrawn student is gone from the class list', async ({ page }) => {
            const enrollment = new EnrollmentPage(page);

            await enrollment.visitClassStudents(ids.classA);
            await expect(enrollment.classStudentRow(student.lastName)).toHaveCount(0);
        });

        test('withdrawing a student who is not enrolled is refused and changes nothing', async ({ page }) => {
            const enrollment = new EnrollmentPage(page);
            await enrollment.visit(ids.student);

            const response = await enrollment.withdraw();

            expect(response.status(), await response.text()).toBeGreaterThanOrEqual(400);
            expect(response.status()).toBeLessThan(500);
            await expect(enrollment.rows).toHaveCount(2);
            await enrollment.expectStatus(classA, 'INACTIVE');
            await enrollment.expectStatus(classB, 'INACTIVE');
        });

        test('the admin is told when a withdrawal is refused', async ({ page }) => {
            const enrollment = new EnrollmentPage(page);
            await enrollment.visit(ids.student);

            await enrollment.withdraw();

            await expect(page.locator('.p-toast-message, .swal2-popup').first()).toBeVisible();
        });

        test('the admin is told when an enrollment is refused, and nothing changes', async ({ page }) => {
            // A real failure is hard to provoke from the UI, so the server's answer is faked for this one request.
            const enrollment = new EnrollmentPage(page);
            await enrollment.visit(ids.student);
            await page.route(/\/enrollments$/, route => route.request().method() === 'POST'
                ? route.fulfill({
                    status: 400,
                    contentType: 'application/json',
                    body: JSON.stringify({ data: null, message: 'Enrollment refused for the test', status: 'BAD_REQUEST' }),
                })
                : route.continue());

            const response = await enrollment.enrollInto(classB);

            expect(response.status()).toBe(400);
            await expect(page.locator('.p-toast-message, .swal2-popup').first()).toBeVisible();
            await page.unroute(/\/enrollments$/);
            await enrollment.visit(ids.student);
            await enrollment.expectStatus(classB, 'INACTIVE');
            await enrollment.expectStatus(classA, 'INACTIVE');
        });

        test('re-enrolling after a withdrawal reactivates the old row', async ({ page }) => {
            const enrollment = new EnrollmentPage(page);
            await enrollment.visit(ids.student);

            const response = await enrollment.enrollInto(classA);

            expect(response.ok(), `status ${response.status()}`).toBeTruthy();
            await expect(enrollment.rows).toHaveCount(2);
            await enrollment.expectStatus(classA, 'ACTIVE');
            await enrollment.expectStatus(classB, 'INACTIVE');
        });
    });
});

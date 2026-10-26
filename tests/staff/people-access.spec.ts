import { Browser } from '@playwright/test';
import { authenticatedTest as test, expect } from '../fixtures';
import { StaffPage } from '../pages/StaffPage';
import { StudentsPage } from '../pages/StudentsPage';
import { makeGuardian, makeStaff, makeStudent } from '../data/people';
import { Session, signIn, signInAndSetPassword } from '../helpers/session';

/**
 * Who can open the people pages? The admin sees everything. A teacher and a guardian sign in
 * to their own dashboards and should be kept out of the staff, student and guardian
 * management pages (the app answers with its 403 page). Accounts are created through the
 * portal, so no extra test users are needed.
 */
const teacher = makeStaff({ employeeType: 'Teacher' });
const student = makeStudent();
const guardian = makeGuardian({ isPrimary: true });
const PASSWORD = 'Newpass#12345';

const PAGES = {
    'students list': '/peoples/students/students-list',
    'student bulk upload': '/peoples/students/bulk-upload',
    'staff list': '/peoples/staff/staff-list',
    'add staff form': '/peoples/staff/add-staff',
    'guardians list': '/peoples/guardians/guardians-list',
} as const;

const ROLES = {
    teacher: { username: () => teacher.email },
    guardian: { username: () => guardian.phoneNumber },
} as const;

async function openAs(browser: Browser, role: keyof typeof ROLES, path: string): Promise<Session> {
    const session = await signIn(browser, ROLES[role].username(), PASSWORD);
    await session.page.goto(path);
    return session;
}

test.describe.serial('People pages — role access', () => {
    test('creates a teacher, and a student with a guardian, and completes their first logins', async ({ page, browser }) => {
        test.setTimeout(120_000);
        const staffPage = new StaffPage(page);
        await staffPage.visitAddForm();
        await staffPage.fillStaffForm(teacher);
        const [staffResponse] = await Promise.all([
            page.waitForResponse(res => res.url().includes('/employees') && res.request().method() === 'POST'),
            staffPage.submitForm(),
        ]);
        expect(staffResponse.ok(), `status ${staffResponse.status()}`).toBeTruthy();

        const studentsPage = new StudentsPage(page);
        await studentsPage.visitAddForm();
        await studentsPage.fillStudentForm(student);
        await studentsPage.addGuardian(guardian);
        const [studentResponse] = await Promise.all([
            page.waitForResponse(res => res.url().includes('/students') && !res.url().includes('/guardians') && res.request().method() === 'POST'),
            studentsPage.submitForm(),
        ]);
        expect(studentResponse.ok(), `status ${studentResponse.status()}`).toBeTruthy();

        // first login forces a password change; do it once here so the tests below just sign in
        for (const role of ['teacher', 'guardian'] as const) {
            const session = await signInAndSetPassword(browser, ROLES[role].username(), PASSWORD);
            await session.close();
        }
    });

    for (const role of ['teacher', 'guardian'] as const) {
        test.describe(`as a ${role}`, () => {
            for (const name of ['students list', 'student bulk upload'] as const) {
                test(`cannot open the ${name}`, async ({ browser }) => {
                    const session = await openAs(browser, role, PAGES[name]);

                    await expect(session.page).toHaveURL(/error-403/);
                    await expect(session.page.getByText(/forbidden/i).first()).toBeVisible();
                    await session.close();
                });
            }

            for (const name of ['staff list', 'add staff form', 'guardians list'] as const) {
                test(`cannot open the ${name}`, async ({ browser }) => {
                    const session = await openAs(browser, role, PAGES[name]);

                    await expect(session.page).toHaveURL(/error-403/);
                    await session.close();
                });
            }
        });
    }
});

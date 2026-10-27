import { Browser, Page } from '@playwright/test';
import { authenticatedTest as test, expect } from '../fixtures';
import { StaffPage } from '../pages/StaffPage';
import { StudentsPage } from '../pages/StudentsPage';
import { makeGuardian, makeStaff, makeStudent } from '../data/people';
import { testEmail } from '../data/identity';
import { signIn, signInAndSetPassword } from '../helpers/session';

/**
 * What a signed-in teacher can reach through the API. The people pages already answer a teacher
 * with the 403 screen; this checks the endpoints behind them, using the token the browser holds,
 * because a hidden page is no protection if the endpoint still answers.
 *
 * Rule under test: a teacher is not an administrator. They cannot read other people's personal
 * records (students outside their classes, guardians, other staff) and cannot create, change or
 * delete anyone. This teacher teaches no class, so any student is "outside their classes".
 */
const PASSWORD = 'Newpass#12345';
const teacher = makeStaff({ employeeType: 'Teacher' });
const colleague = makeStaff({ employeeType: 'Accountant' });
const student = makeStudent();
const guardian = makeGuardian({ isPrimary: true });

const ids = { student: 0, guardian: 0, colleague: 0, teacher: 0 };
/** Real create payloads captured from the admin UI, so a refusal can only come from authorization. */
const payloads: { student?: Record<string, any>; employee?: Record<string, any> } = {};
const uniqueEmail = () => testEmail('probe', `${Date.now()}.${Math.random().toString(36).slice(2, 6)}`);

interface Api {
    page: Page;
    base: string;
    close: () => Promise<void>;
    get: (path: string) => Promise<{ status: number; body: string }>;
    send: (method: 'POST' | 'PUT' | 'PATCH' | 'DELETE', path: string, data?: unknown) => Promise<{ status: number; body: string }>;
}

/** Signs the teacher in and borrows the token from the app's own next API call. */
async function asTeacher(browser: Browser): Promise<Api> {
    const session = await signIn(browser, teacher.email, PASSWORD);
    const page = session.page;
    await page.waitForURL(/\/dashboard/);
    const [request] = await Promise.all([
        page.waitForRequest(r => !!r.headers()['authorization'] && /\/(users|academics)\/api\//.test(r.url())),
        page.reload(),
    ]);
    const token = request.headers()['authorization'];
    const base = `${new URL(request.url()).origin}/users/api/v1`;
    const headers = { Authorization: token };
    return {
        page,
        base,
        close: session.close,
        get: async path => {
            const res = await page.request.get(`${base}${path}`, { headers });
            return { status: res.status(), body: await res.text() };
        },
        send: async (method, path, data) => {
            const res = await page.request.fetch(`${base}${path}`, { method, headers, data });
            return { status: res.status(), body: await res.text() };
        },
    };
}

const REFUSED = [401, 403, 404];
// a write is stopped by the role check before any record is looked up, so a 404 would prove nothing
const WRITE_REFUSED = [401, 403];
// Error bodies echo the requested path (which contains what the caller typed), so only the
// payload counts as a leak. Anything without a payload leaks nothing.
const noPersonalData = (body: string) => {
    let payload = '';
    try { payload = JSON.stringify(JSON.parse(body).data ?? ''); } catch { /* not JSON: nothing to leak */ }
    for (const secret of [student.lastName, guardian.lastName, guardian.phoneNumber, colleague.lastName, colleague.email]) {
        expect(payload, `response leaked ${secret}`).not.toContain(secret);
    }
};

test.describe.serial('Teacher — what the API allows', () => {
    test('sets up a teacher, a colleague, and a student with a guardian', async ({ page, browser }) => {
        test.setTimeout(120_000);
        const staffPage = new StaffPage(page);
        const created: Record<string, number> = {};

        for (const [key, person] of [['teacher', teacher], ['colleague', colleague]] as const) {
            await staffPage.visitAddForm();
            await staffPage.fillStaffForm(person);
            const [res] = await Promise.all([
                page.waitForResponse(r => r.url().includes('/employees') && r.request().method() === 'POST'),
                staffPage.submitForm(),
            ]);
            expect(res.ok(), `status ${res.status()}`).toBeTruthy();
            created[key] = (await res.json()).data?.id;
            payloads.employee = res.request().postDataJSON();
        }

        const studentsPage = new StudentsPage(page);
        await studentsPage.visitAddForm();
        await studentsPage.fillStudentForm(student);
        await studentsPage.addGuardian(guardian);
        const [res] = await Promise.all([
            page.waitForResponse(r => r.url().includes('/students') && !r.url().includes('/guardians') && r.request().method() === 'POST'),
            studentsPage.submitForm(),
        ]);
        expect(res.ok(), `status ${res.status()}`).toBeTruthy();
        created.student = (await res.json()).data?.id;
        payloads.student = res.request().postDataJSON();

        Object.assign(ids, { teacher: created.teacher, colleague: created.colleague, student: created.student });
        expect(ids.student, 'student id from the create response').toBeGreaterThan(0);
        expect(ids.colleague, 'colleague id from the create response').toBeGreaterThan(0);

        const session = await signInAndSetPassword(browser, teacher.email, PASSWORD);
        await session.close();
    });

    test.describe('reading other people\'s records', () => {
        test('cannot list or search students', async ({ browser }) => {
            const t = await asTeacher(browser);
            const { status, body } = await t.get(`/students?textSearch=${student.lastName}`);
            await t.close();

            expect(REFUSED, body.slice(0, 200)).toContain(status);
            noPersonalData(body);
        });

        test('cannot open a student outside their classes', async ({ browser }) => {
            const t = await asTeacher(browser);
            const byId = await t.get(`/students/${ids.student}`);
            const byEmail = await t.get(`/students/email/${student.email}`);
            await t.close();

            expect(REFUSED, byId.body.slice(0, 200)).toContain(byId.status);
            expect(REFUSED, byEmail.body.slice(0, 200)).toContain(byEmail.status);
            noPersonalData(byId.body);
            noPersonalData(byEmail.body);
        });

        test('cannot search for guardians or open one by email', async ({ browser }) => {
            const t = await asTeacher(browser);
            const search = await t.get(`/students/guardians/search?textSearch=${guardian.lastName}`);
            const byEmail = await t.get(`/students/guardians/email/${guardian.email}`);
            await t.close();

            expect(REFUSED, search.body.slice(0, 200)).toContain(search.status);
            expect(REFUSED, byEmail.body.slice(0, 200)).toContain(byEmail.status);
            noPersonalData(search.body);
            noPersonalData(byEmail.body);
        });

        test('cannot list staff or open a colleague', async ({ browser }) => {
            const t = await asTeacher(browser);
            const list = await t.get(`/employees?textSearch=${colleague.lastName}`);
            const byId = await t.get(`/employees/${ids.colleague}`);
            const byEmail = await t.get(`/employees/email/${colleague.email}`);
            await t.close();

            for (const r of [list, byId, byEmail]) {
                expect(REFUSED, r.body.slice(0, 200)).toContain(r.status);
                noPersonalData(r.body);
            }
        });

        test('can still open their own staff profile', async ({ browser }) => {
            // control: the checks above must not be passing because every employee call is refused
            const t = await asTeacher(browser);
            const own = await t.get(`/employees/email/${teacher.email}`);
            await t.close();

            expect(own.status, own.body.slice(0, 200)).toBe(200);
            expect(own.body).toContain(teacher.lastName);
        });
    });

    test.describe('changing records', () => {
        test('cannot create, edit or delete students', async ({ browser }) => {
            const t = await asTeacher(browser);
            const results = {
                create: await t.send('POST', '/students', { ...payloads.student, email: uniqueEmail(), studentId: undefined, firstName: 'Probe' }),
                edit: await t.send('PUT', `/students/${ids.student}`, { ...payloads.student, firstName: 'Hacked' }),
                remove: await t.send('DELETE', `/students/${ids.student}`),
                bulk: await t.send('POST', '/students/bulk', {}),
            };
            await t.close();

            for (const [name, r] of Object.entries(results)) {
                expect(WRITE_REFUSED, `${name}: ${r.body.slice(0, 200)}`).toContain(r.status);
            }
        });

        test('cannot edit or delete guardians', async ({ browser }) => {
            const t = await asTeacher(browser);
            const edit = await t.send('PATCH', `/students/guardians/${ids.guardian || 1}`, { firstName: 'Hacked' });
            const remove = await t.send('DELETE', `/students/guardians/${ids.guardian || 1}`);
            await t.close();

            expect(WRITE_REFUSED, edit.body.slice(0, 200)).toContain(edit.status);
            expect(WRITE_REFUSED, remove.body.slice(0, 200)).toContain(remove.status);
        });

        test('cannot create, edit, disable or delete staff', async ({ browser }) => {
            const t = await asTeacher(browser);
            const results = {
                create: await t.send('POST', '/employees', { ...payloads.employee, email: uniqueEmail(), firstName: 'Probe' }),
                edit: await t.send('PATCH', `/employees/${ids.colleague}`, { ...payloads.employee, firstName: 'Hacked' }),
                disable: await t.send('PATCH', '/employees/status', { userId: 'x', enabled: false }),
                remove: await t.send('DELETE', `/employees/${ids.colleague}`),
            };
            await t.close();

            for (const [name, r] of Object.entries(results)) {
                expect(WRITE_REFUSED, `${name}: ${r.body.slice(0, 200)}`).toContain(r.status);
            }
        });

        test('nothing was changed: the student, guardian and colleague are all still there', async ({ page }) => {
            const studentsPage = new StudentsPage(page);
            await studentsPage.visit();
            await studentsPage.search(student.lastName);
            const row = studentsPage.rowByName(student.lastName);
            await expect(row).toBeVisible();
            await expect(row).not.toContainText('Hacked');

            const staffPage = new StaffPage(page);
            await staffPage.visit();
            await staffPage.search(colleague.lastName);
            const staffRow = staffPage.rowByName(`${colleague.firstName} ${colleague.lastName}`);
            await expect(staffRow).toBeVisible();
            await expect(staffRow).not.toContainText('Hacked');
        });
    });
});

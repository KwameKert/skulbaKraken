import { Browser, Page } from '@playwright/test';
import { authenticatedTest as test, expect, loggedOut } from '../fixtures';
import { LoginPage } from '../pages/LoginPage';
import { StudentsPage } from '../pages/StudentsPage';
import { makeGuardian, makeStudent } from '../data/people';
import { getLoginCredentials } from '../data/credentials';
import { TEMP_PASSWORD } from '../helpers/session';

/**
 * Data isolation between families. A parent signs in, the sidebar loads their children
 * (GET /students/guardians/{id}/students) and picking one loads that child's dashboard.
 * A parent must only ever see their own children, and must not be able to reach another
 * family's data by calling the same endpoints with a different id.
 *
 * Family A: one guardian with two children (siblings share the guardian by phone).
 * Family B: a separate guardian with one child.
 */
const PASSWORD = 'Newpass#12345';
const guardianA = makeGuardian({ isPrimary: true });
const guardianB = makeGuardian({ isPrimary: true });
const childA1 = makeStudent();
const childA2 = makeStudent();
const childB1 = makeStudent();

const nameOf = (s: { firstName: string; lastName: string }) => `${s.firstName} ${s.lastName}`;

const isStudentCreate = (res: { url(): string; request(): { method(): string } }) =>
    res.url().includes('/students') && !res.url().includes('/guardians') && res.request().method() === 'POST';

interface Family {
    page: Page;
    close: () => Promise<void>;
    /** Taken from the app's own calls, so the probes use exactly what the browser sent. */
    token: string;
    apiBase: string;
    guardianId: number;
    studentIds: number[];
}

/** Signs a guardian in (setting a new password on first login) and records what the app fetched. */
async function signInGuardian(browser: Browser, phone: string, password: string, firstLogin = false): Promise<Family> {
    const context = await browser.newContext(loggedOut);
    const page = await context.newPage();
    const family = { token: '', apiBase: '', guardianId: 0, studentIds: [] as number[] };

    page.on('request', req => {
        const auth = req.headers()['authorization'];
        if (auth && req.url().includes('/users/api/')) family.token = auth;
    });
    page.on('response', async res => {
        const url = res.url();
        try {
            if (url.endsWith('/students/guardians/username') && res.ok()) {
                family.guardianId = (await res.json()).data.id;
            }
            const m = url.match(/^(.*\/users\/api\/v1)\/students\/guardians\/\d+\/students$/);
            if (m && res.ok()) {
                family.apiBase = m[1];
                family.studentIds = (await res.json()).data.map((s: { id: number }) => s.id);
            }
        } catch { /* body not readable (redirect etc.) - ignore */ }
    });

    const login = new LoginPage(page);
    await login.visit();
    await login.login(phone, firstLogin ? TEMP_PASSWORD : password);
    if (firstLogin) await login.completeRequiredPasswordUpdate(password);
    await page.waitForURL(/\/dashboard/);
    await expect(page.locator('.dropdown.my-4 a[data-bs-toggle="dropdown"]')).toBeVisible();
    await expect.poll(() => family.studentIds.length, { message: 'sidebar never loaded the children' }).toBeGreaterThan(0);

    return { page, close: () => context.close(), ...family };
}

const selector = (page: Page) => page.locator('.dropdown.my-4');
const childOptions = (page: Page) => selector(page).locator('.dropdown-item');

async function openSelector(page: Page) {
    await selector(page).locator('a[data-bs-toggle="dropdown"]').click();
}

test.describe.serial('Guardian data isolation', () => {
    test('sets up two families and completes the first logins', async ({ page, browser }) => {
        test.setTimeout(120_000);
        const studentsPage = new StudentsPage(page);

        for (const [child, guardian] of [[childA1, guardianA], [childA2, guardianA], [childB1, guardianB]] as const) {
            await studentsPage.visitAddForm();
            await studentsPage.fillStudentForm(child);
            await studentsPage.addGuardian(guardian);
            const [response] = await Promise.all([page.waitForResponse(isStudentCreate), studentsPage.submitForm()]);
            expect(response.ok(), `status ${response.status()}: ${await response.text()}`).toBeTruthy();
            await expect(page).toHaveURL(/student-details\/\d+/i);
        }

        for (const g of [guardianA, guardianB]) {
            const family = await signInGuardian(browser, g.phoneNumber, PASSWORD, true);
            await family.close();
        }
    });

    test('a parent sees all of their own children and nobody else\'s', async ({ browser }) => {
        const a = await signInGuardian(browser, guardianA.phoneNumber, PASSWORD);

        await openSelector(a.page);
        await expect(childOptions(a.page)).toHaveCount(2);
        await expect(childOptions(a.page).filter({ hasText: nameOf(childA1) })).toHaveCount(1);
        await expect(childOptions(a.page).filter({ hasText: nameOf(childA2) })).toHaveCount(1);
        await expect(selector(a.page)).not.toContainText(childB1.lastName);
        await a.close();
    });

    test('another family only sees its own child', async ({ browser }) => {
        const b = await signInGuardian(browser, guardianB.phoneNumber, PASSWORD);

        await openSelector(b.page);
        await expect(childOptions(b.page)).toHaveCount(1);
        await expect(childOptions(b.page).first()).toContainText(nameOf(childB1));
        await expect(selector(b.page)).not.toContainText(childA1.lastName);
        await expect(selector(b.page)).not.toContainText(childA2.lastName);
        await b.close();
    });

    test('picking a child loads that child\'s record, and switching loads the sibling', async ({ browser }) => {
        const a = await signInGuardian(browser, guardianA.phoneNumber, PASSWORD);
        const isStudentRecord = (res: { url(): string; request(): { method(): string } }) =>
            /\/users\/api\/v1\/students\/\d+$/.test(res.url()) && res.request().method() === 'GET';

        for (const child of [childA1, childA2, childA1]) {
            await openSelector(a.page);
            const [response] = await Promise.all([
                a.page.waitForResponse(isStudentRecord),
                childOptions(a.page).filter({ hasText: nameOf(child) }).click(),
            ]);
            expect(response.ok(), `status ${response.status()}`).toBeTruthy();
            const record = (await response.json()).data;
            expect(`${record.firstName} ${record.lastName}`).toBe(nameOf(child));
            expect(a.studentIds).toContain(record.id);
            await expect(selector(a.page).locator('a[data-bs-toggle="dropdown"]')).toContainText(nameOf(child));
        }
        await a.close();
    });

    test('a child who is not enrolled in a class yet still shows on the parent dashboard', async ({ browser }) => {
        const a = await signInGuardian(browser, guardianA.phoneNumber, PASSWORD);
        const content = a.page.locator('.page-wrapper');

        await openSelector(a.page);
        await childOptions(a.page).filter({ hasText: nameOf(childA1) }).click();

        await expect(content.getByText(nameOf(childA1)).first()).toBeVisible();
        await expect(content.getByText(childA2.lastName)).toHaveCount(0);
        await expect(content.getByText(childB1.lastName)).toHaveCount(0);
        await a.close();
    });

    test.describe('calling the API with another family\'s ids', () => {
        let b: Family;

        test.beforeAll(async ({ browser }) => {
            b = await signInGuardian(browser, guardianB.phoneNumber, PASSWORD);
        });
        test.afterAll(async () => b.close());

        // The parent signs in as A, then asks for B's records using A's own token.
        const asParentA = async (browser: Browser, call: (family: Family) => Promise<{ status: number; body: string }>) => {
            const a = await signInGuardian(browser, guardianA.phoneNumber, PASSWORD);
            const result = await call(a);
            await a.close();
            return result;
        };
        const get = (family: Family, url: string) => async () => {
            const res = await family.page.request.get(url, { headers: { Authorization: family.token } });
            return { status: res.status(), body: await res.text() };
        };

        test('cannot list another guardian\'s children', async ({ browser }) => {
            const { status, body } = await asParentA(browser, a =>
                get(a, `${a.apiBase}/students/guardians/${b.guardianId}/students`)());

            expect(status, body.slice(0, 200)).toBeGreaterThanOrEqual(400);
            expect(body).not.toContain(childB1.lastName);
        });

        test('cannot open another family\'s child by id', async ({ browser }) => {
            const { status, body } = await asParentA(browser, a =>
                get(a, `${a.apiBase}/students/${b.studentIds[0]}`)());

            expect(status, body.slice(0, 200)).toBeGreaterThanOrEqual(400);
            expect(body).not.toContain(childB1.lastName);
        });

        test('cannot look up another guardian by claiming their username', async ({ browser }) => {
            const { status, body } = await asParentA(browser, async a => {
                const res = await a.page.request.post(`${a.apiBase}/students/guardians/username`, {
                    headers: { Authorization: a.token },
                    data: { email: guardianB.email, username: guardianB.phoneNumber },
                });
                return { status: res.status(), body: await res.text() };
            });

            expect(body).not.toContain(guardianB.lastName);
            expect(status, body.slice(0, 200)).toBeGreaterThanOrEqual(400);
        });
    });

    test.describe('a parent cannot browse people they are not responsible for', () => {
        // Lists and searches take no id, so the risk is a parent seeing everyone. Searching for
        // family B's unique names makes a leak certain to show up on the first page.
        const ADMIN_EMAIL = getLoginCredentials().email;

        async function asParentA(browser: Browser, path: (apiBase: string) => string) {
            const a = await signInGuardian(browser, guardianA.phoneNumber, PASSWORD);
            const res = await a.page.request.get(path(a.apiBase), { headers: { Authorization: a.token } });
            const body = await res.text();
            await a.close();
            return { status: res.status(), body };
        }
        const leaksNothing = (body: string) => {
            expect(body).not.toContain(childB1.lastName);
            expect(body).not.toContain(guardianB.lastName);
            expect(body).not.toContain(guardianB.phoneNumber);
        };

        test('the student list does not return other families\' students', async ({ browser }) => {
            const { body } = await asParentA(browser, api => `${api}/students?textSearch=${childB1.lastName}`);
            leaksNothing(body);
        });

        test('looking up a student by email is refused', async ({ browser }) => {
            const { status, body } = await asParentA(browser, api => `${api}/students/email/${childB1.email}`);
            expect(status, body.slice(0, 200)).toBeGreaterThanOrEqual(400);
            leaksNothing(body);
        });

        test('the guardian search does not return other guardians', async ({ browser }) => {
            const { body } = await asParentA(browser, api => `${api}/students/guardians/search?textSearch=${guardianB.lastName}`);
            leaksNothing(body);
        });

        test('opening another guardian by id is refused', async ({ browser }) => {
            const b = await signInGuardian(browser, guardianB.phoneNumber, PASSWORD);
            const { status, body } = await asParentA(browser, api => `${api}/students/guardians/${b.guardianId}`);
            await b.close();

            expect(status, body.slice(0, 200)).toBeGreaterThanOrEqual(400);
            leaksNothing(body);
        });

        test('opening another guardian by email is refused', async ({ browser }) => {
            const { status, body } = await asParentA(browser, api => `${api}/students/guardians/email/${guardianB.email}`);

            expect(status, body.slice(0, 200)).toBeGreaterThanOrEqual(400);
            leaksNothing(body);
        });

        test('staff details are not available to a parent', async ({ browser }) => {
            const { status, body } = await asParentA(browser, api => `${api}/employees/email/${ADMIN_EMAIL}`);
            expect(status, body.slice(0, 200)).toBeGreaterThanOrEqual(400);
            expect(body).not.toContain(ADMIN_EMAIL);
        });

        test('control: the admin can still search students', async ({ page }) => {
            // proves the checks above are not passing just because the endpoints reject everyone
            const studentsPage = new StudentsPage(page);
            await studentsPage.visit();
            await studentsPage.search(childB1.lastName);
            await expect(studentsPage.rowByName(childB1.lastName)).toBeVisible();
        });
    });

    test('a deleted child disappears from the parent\'s selector', async ({ page, browser }) => {
        const studentsPage = new StudentsPage(page);
        await studentsPage.visit();
        await studentsPage.search(childA2.lastName);
        await expect(studentsPage.rowByName(childA2.lastName)).toBeVisible();
        await studentsPage.clickDeleteInRow(childA2.lastName);
        const [response] = await Promise.all([
            page.waitForResponse(res => res.url().includes('/students') && res.request().method() === 'DELETE'),
            studentsPage.confirmSwalDelete(),
        ]);
        expect(response.ok()).toBeTruthy();

        const a = await signInGuardian(browser, guardianA.phoneNumber, PASSWORD);
        await openSelector(a.page);
        await expect(childOptions(a.page)).toHaveCount(1);
        await expect(childOptions(a.page).first()).toContainText(nameOf(childA1));
        await expect(selector(a.page)).not.toContainText(childA2.lastName);
        await a.close();
    });
});

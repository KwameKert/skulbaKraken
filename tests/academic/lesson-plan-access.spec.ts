import { Browser } from '@playwright/test';
import { authenticatedTest as test, expect } from '../fixtures';
import { getLoginCredentials } from '../data/credentials';
import { makeGuardian, makeStaff, makeStudent } from '../data/people';
import { ApiResult, ApiSession, openApiSession, payloadOf } from '../helpers/api';
import { signInAndSetPassword } from '../helpers/session';
import { createChild } from '../helpers/students';
import { loadTimetableFixture, TimetableFixture } from '../helpers/timetable-fixture';
import { StaffPage } from '../pages/StaffPage';

/**
 * Who can read and change a lesson plan through the API:
 *  - a teacher reads and changes only their own plans; a colleague's plans are "not found" to them
 *  - a teacher cannot approve or put a plan under review, nor write a plan as someone else
 *  - a teacher cannot hand a plan to another teacher
 *  - a parent can do none of it
 * The owner is the class teacher built in setup (tests/setup/07-timetable.spec.ts); the plans are
 * written by the administrator on their behalf so every check is against a plan that exists.
 */
const tag = Date.now().toString(36);
const PASSWORD = 'Newpass#12345';
const intruder = makeStaff({ employeeType: 'Teacher' });
const child = makeStudent();
const parent = makeGuardian({ isPrimary: true });

let fixture: TimetableFixture;
let admin: ApiSession;
let ownerId = 0;
let lessonId = 0;
let lessonDate = '';
const plans = { kept: 0, doomed: 0 };
const secret = `Secret plan ${tag}`;

const asOwner = (browser: Browser) => openApiSession(browser, fixture.teacher.email, fixture.teacherPassword);
const asIntruder = (browser: Browser) => openApiSession(browser, intruder.email, PASSWORD);
const asParent = (browser: Browser) => openApiSession(browser, parent.phoneNumber, PASSWORD);

const base = () => `${admin.academics}/lesson-planners`;
const body = (extra: Record<string, unknown> = {}) => ({
    employeeId: ownerId, lessonId, lessonDate, status: 'DRAFT',
    title: secret, topic: `Topic ${tag}`, description: `<p>${secret}</p>`, summary: `Summary ${tag}`, reflection: '',
    ...extra,
});

function isoDaysAfter(start: string, days: number): string {
    const [y, m, d] = start.split('-').map(Number);
    return new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10);
}

async function stored(id: number) {
    const r = await admin.get(`${base()}/${id}`);
    expect(r.status, r.body.slice(0, 160)).toBe(200);
    return JSON.parse(r.body).data;
}

const REFUSED = [401, 403, 404];

test.describe.serial('Lesson plans — who can read and change them', () => {
    test.beforeAll(async ({ browser }) => {
        fixture = loadTimetableFixture();
        const { email, password } = getLoginCredentials();
        admin = await openApiSession(browser, email, password);
    });

    test.afterAll(async () => {
        await admin?.close();
    });

    test('sets up two plans for the class teacher, a colleague and a parent', async ({ page, browser }) => {
        test.setTimeout(360_000);
        const term = JSON.parse((await admin.get(`${admin.academics}/terms/${fixture.termId}`)).body).data;
        lessonDate = isoDaysAfter(term.startDate, 8);

        const dashboard = await admin.get(`${admin.academics}/dashboard/teacher/${encodeURIComponent(fixture.teacher.email)}`);
        expect(dashboard.status, dashboard.body.slice(0, 160)).toBe(200);
        ownerId = JSON.parse(dashboard.body).data.courseList[0].teacherId;
        expect(ownerId).toBeGreaterThan(0);

        const lessons = await admin.get(`${admin.academics}/time-table/lesson/search?termId=${fixture.termId}&classId=${fixture.classId}`);
        lessonId = JSON.parse(lessons.body).data[0].id;

        for (const key of ['kept', 'doomed'] as const) {
            const r = await admin.send('POST', base(), body());
            expect(r.status, r.body.slice(0, 160)).toBe(201);
            plans[key] = JSON.parse(r.body).data.id;
        }

        const staffPage = new StaffPage(page);
        await staffPage.visitAddForm();
        await staffPage.fillStaffForm(intruder);
        await Promise.all([
            page.waitForResponse(r => r.url().includes('/employees') && r.request().method() === 'POST'),
            staffPage.submitForm(),
        ]);
        await createChild(page, child, parent);

        for (const username of [intruder.email, parent.phoneNumber]) {
            await (await signInAndSetPassword(browser, username, PASSWORD)).close();
        }
    });

    test('control: the owner reads, lists and changes their own plan', async ({ browser }) => {
        const t = await asOwner(browser);
        const one = await t.get(`${base()}/${plans.kept}`);
        const list = await t.get(`${base()}?size=100`);
        const overview = await t.get(`${base()}/weekly-overview?termId=${fixture.termId}`);
        const edit = await t.send('PATCH', `${base()}/${plans.kept}`, body({ status: 'SUBMITTED' }));
        await t.close();

        expect(one.status, one.body.slice(0, 160)).toBe(200);
        expect(list.status, list.body.slice(0, 160)).toBe(200);
        expect(payloadOf(list.body)).toContain(secret);
        expect(overview.status, overview.body.slice(0, 160)).toBe(200);
        expect(edit.status, edit.body.slice(0, 160)).toBe(200);
        expect((await stored(plans.kept)).status).toBe('SUBMITTED');
    });

    test.describe('a teacher who does not own the plan', () => {
        test('cannot read it, by id, in a list, or in the weekly overview', async ({ browser }) => {
            const t = await asIntruder(browser);
            const one = await t.get(`${base()}/${plans.kept}`);
            const own = await t.get(`${base()}?size=100`);
            const theirs = await t.get(`${base()}?employeeId=${ownerId}&size=100`);
            const overview = await t.get(`${base()}/weekly-overview?termId=${fixture.termId}`);
            const overviewTheirs = await t.get(`${base()}/weekly-overview?termId=${fixture.termId}&employeeId=${ownerId}`);
            await t.close();

            expect(REFUSED, `by id: ${one.status}`).toContain(one.status);
            expect(payloadOf(one.body)).not.toContain(secret);
            // their own search is fine, and holds nothing of the owner's
            expect(own.status, own.body.slice(0, 160)).toBe(200);
            expect(payloadOf(own.body)).not.toContain(secret);
            expect(REFUSED, `list of the owner's: ${theirs.status}`).toContain(theirs.status);
            expect(payloadOf(theirs.body)).not.toContain(secret);
            expect(overview.status, overview.body.slice(0, 160)).toBe(200);
            expect(payloadOf(overview.body)).not.toContain('Topic ' + tag);
            expect(REFUSED, `overview of the owner's: ${overviewTheirs.status}`).toContain(overviewTheirs.status);
            expect(payloadOf(overviewTheirs.body)).not.toContain('Topic ' + tag);
        });

        test('cannot change, delete or review it', async ({ browser }) => {
            const t = await asIntruder(browser);
            const edit = await t.send('PATCH', `${base()}/${plans.kept}`, body({ title: 'Hijacked' }));
            const remove = await t.send('DELETE', `${base()}/${plans.doomed}`);
            const review = await t.send('PATCH', `${base()}/${plans.kept}/comment`, { employeeId: ownerId, comment: 'Hijacked' });
            await t.close();

            for (const [name, r] of Object.entries({ edit, remove, review })) {
                expect.soft(REFUSED, `${name}: ${r.status} ${r.body.slice(0, 160)}`).toContain(r.status);
            }
        });

        test('cannot write a plan as the owner', async ({ browser }) => {
            const t = await asIntruder(browser);
            const r = await t.send('POST', base(), body({ title: 'Forged' }));
            await t.close();
            expect(REFUSED, `${r.status} ${r.body.slice(0, 160)}`).toContain(r.status);
        });
    });

    test.describe('the owner', () => {
        test('cannot approve a plan or put it under review, however they ask', async ({ browser }) => {
            const t = await asOwner(browser);
            const results: Record<string, ApiResult> = {
                'approve': await t.send('PATCH', `${base()}/${plans.kept}`, body({ status: 'APPROVED' })),
                'review': await t.send('PATCH', `${base()}/${plans.kept}`, body({ status: 'REVIEW' })),
                'create approved': await t.send('POST', base(), body({ status: 'APPROVED', title: 'Self approved' })),
                'comment': await t.send('PATCH', `${base()}/${plans.kept}/comment`, { employeeId: ownerId, comment: 'Looks good to me' }),
            };
            await t.close();
            for (const [name, r] of Object.entries(results)) {
                expect.soft([401, 403], `${name}: ${r.status} ${r.body.slice(0, 160)}`).toContain(r.status);
            }
        });

        test('cannot hand their plan to another teacher', async ({ browser }) => {
            const t = await asOwner(browser);
            const r = await t.send('PATCH', `${base()}/${plans.kept}`, body({ status: 'SUBMITTED', employeeId: ownerId + 100000 }));
            await t.close();
            // either refused or ignored; what matters is the owner is unchanged
            expect(r.status, r.body.slice(0, 160)).toBeLessThan(500);
            expect((await stored(plans.kept)).employeeId).toBe(ownerId);
        });

        test('cannot write a plan as someone else', async ({ browser }) => {
            const t = await asOwner(browser);
            const r = await t.send('POST', base(), body({ employeeId: ownerId + 100000, title: 'As someone else' }));
            await t.close();
            expect([401, 403], `${r.status} ${r.body.slice(0, 160)}`).toContain(r.status);
        });
    });

    test('a parent can do nothing with lesson plans', async ({ browser }) => {
        const p = await asParent(browser);
        const results: Record<string, ApiResult> = {
            'by id': await p.get(`${base()}/${plans.kept}`),
            'list': await p.get(`${base()}?size=100`),
            'overview': await p.get(`${base()}/weekly-overview?termId=${fixture.termId}`),
            'create': await p.send('POST', base(), body({ title: 'From a parent' })),
            'edit': await p.send('PATCH', `${base()}/${plans.kept}`, body({ title: 'From a parent' })),
            'delete': await p.send('DELETE', `${base()}/${plans.doomed}`),
            'comment': await p.send('PATCH', `${base()}/${plans.kept}/comment`, { employeeId: ownerId, comment: 'From a parent' }),
        };
        await p.close();
        for (const [name, r] of Object.entries(results)) {
            expect.soft([401, 403], `${name}: ${r.status} ${r.body.slice(0, 160)}`).toContain(r.status);
            expect.soft(payloadOf(r.body), `${name} leaked the plan`).not.toContain(secret);
        }
    });

    test('the plans are untouched by the attempts above', async () => {
        const kept = await stored(plans.kept);
        expect(kept).toMatchObject({ title: secret, status: 'SUBMITTED', employeeId: ownerId });
        expect(kept.headTeacherComment ?? null).toBeNull();
        expect((await stored(plans.doomed)).status).toBe('DRAFT');

        const list = JSON.parse((await admin.get(`${base()}?employeeId=${ownerId}&size=100`)).body).data.content as { title: string }[];
        expect(list.filter(p => p.title === 'Hijacked' || p.title === 'Forged' || p.title === 'From a parent' || p.title === 'Self approved' || p.title === 'As someone else')).toEqual([]);
    });

    test('control: the owner deletes their own plan', async ({ browser }) => {
        const t = await asOwner(browser);
        const r = await t.send('DELETE', `${base()}/${plans.doomed}`);
        await t.close();
        expect(r.status, r.body.slice(0, 160)).toBe(200);
        expect((await admin.get(`${base()}/${plans.doomed}`)).status).toBe(404);
    });

    test('control: an administrator reads everything and can approve', async () => {
        const approve = await admin.send('PATCH', `${base()}/${plans.kept}`, body({ status: 'APPROVED' }));
        expect(approve.status, approve.body.slice(0, 160)).toBe(200);
        expect((await stored(plans.kept)).status).toBe('APPROVED');
        const list = await admin.get(`${base()}?size=100`);
        expect(list.status).toBe(200);
        expect(payloadOf(list.body)).toContain(secret);
    });

    test('a reviewer is recorded as the person who reviewed, not whoever the request names', async () => {
        const r = await admin.send('PATCH', `${base()}/${plans.kept}/comment`, { employeeId: ownerId, comment: `Reviewed ${tag}` });
        expect(r.status, r.body.slice(0, 160)).toBe(200);
        const plan = await stored(plans.kept);
        expect(plan.headTeacherComment).toBe(`Reviewed ${tag}`);
        expect(plan.reviewedByEmployeeId, 'the plan owner is not its reviewer').not.toBe(ownerId);
    });
});

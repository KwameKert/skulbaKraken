import { Browser } from '@playwright/test';
import { authenticatedTest as test, expect } from '../fixtures';
import { ApiResult, ApiSession, openApiSession, payloadOf } from '../helpers/api';
import { createClass } from '../helpers/classes';
import { signInAndSetPassword } from '../helpers/session';
import { createChild, enrol } from '../helpers/students';
import { ClassDetailsPage } from '../pages/ClassDetailsPage';
import { CoursePage } from '../pages/CoursePage';
import { GradeRecordPage } from '../pages/GradeRecordPage';
import { GradeScalePage, STANDARD_SCALE } from '../pages/GradeScalePage';
import { StaffPage } from '../pages/StaffPage';
import { makeGuardian, makeStaff, makeStudent } from '../data/people';

/**
 * Who can read and change a student's report card through the API:
 *  - a parent never sees another family's child, and never a draft, not even their own child's
 *  - a teacher reads and writes the report cards of the classes they teach, not everyone's
 *  - a parent cannot write a report card
 * The single report, its PDF and the bulk PDF are three doors onto the same record, so all three are tried.
 *
 * Class A (teacher Ama, family A) and class B (teacher Kofi, family B) each have one student whose
 * class teacher writes a draft report card.
 */
const PASSWORD = 'Newpass#12345';
const tag = Date.now().toString(36);
const classA = `Cards A ${tag}`;
const classB = `Cards B ${tag}`;
const courseA = `Geometric ${tag}`;
const courseB = `Zoological ${tag}`;
const ama = makeStaff({ employeeType: 'Teacher' }); // class teacher and course teacher of class A
const kofi = makeStaff({ employeeType: 'Teacher' }); // class teacher and course teacher of class B
const childA = makeStudent();
const childB = makeStudent();
const guardianA = makeGuardian({ isPrimary: true });
const guardianB = makeGuardian({ isPrimary: true });
const nameOf = (t: { firstName: string; lastName: string }) => `${t.firstName} ${t.lastName}`;

const ids = { reportA: 0, reportB: 0, classA: 0, classB: 0, ccA: 0, ccB: 0, childA: 0, childB: 0, recordA: 0, recordB: 0, enrollmentA: 0, enrollmentB: 0, term: 0 };

const remarkA = `Remark for A ${tag}`;
const remarkB = `Remark for B ${tag}`;

const REFUSED = [401, 403, 404];
const WRITE_REFUSED = [401, 403, 404];

const asParentA = (browser: Browser) => openApiSession(browser, guardianA.phoneNumber, PASSWORD);
const asAma = (browser: Browser) => openApiSession(browser, ama.email, PASSWORD);
const asKofi = (browser: Browser) => openApiSession(browser, kofi.email, PASSWORD);


test.describe.serial('Report cards — who can read and change them', () => {
    test('sets up two classes with a teacher, a family and a scored student each', async ({ page, browser }) => {
        test.setTimeout(360_000);
        await new GradeScalePage(page).ensureScale(STANDARD_SCALE);

        const staffPage = new StaffPage(page);
        for (const teacher of [ama, kofi]) {
            await staffPage.visitAddForm();
            await staffPage.fillStaffForm(teacher);
            await Promise.all([
                page.waitForResponse(r => r.url().includes('/employees') && r.request().method() === 'POST'),
                staffPage.submitForm(),
            ]);
        }

        const courses = new CoursePage(page);
        expect((await courses.createCourse({ name: courseA, courseId: `AL${tag}`, teacherName: nameOf(ama) })).ok()).toBeTruthy();
        expect((await courses.createCourse({ name: courseB, courseId: `BO${tag}`, teacherName: nameOf(kofi) })).ok()).toBeTruthy();

        ids.classA = await createClass(page, classA, 'ACTIVE', nameOf(ama));
        ids.classB = await createClass(page, classB, 'ACTIVE', nameOf(kofi));
        const details = new ClassDetailsPage(page);
        for (const [classId, course, key] of [[ids.classA, courseA, 'ccA'], [ids.classB, courseB, 'ccB']] as const) {
            await details.visit(classId);
            await details.openCoursesTab();
            const assigned = await details.assignCourse({ courseName: course, periods: 3 });
            expect(assigned.ok(), `status ${assigned.status()}`).toBeTruthy();
            ids[key] = (await assigned.json()).data.id;
        }

        ids.childA = await createChild(page, childA, guardianA);
        await enrol(page, ids.childA, classA);
        ids.childB = await createChild(page, childB, guardianB);
        await enrol(page, ids.childB, classB);

        const grades = new GradeRecordPage(page);
        for (const [key, classCourse, pupil] of [['A', ids.ccA, childA], ['B', ids.ccB, childB]] as const) {
            await grades.visit(classCourse);
            const response = await grades.record(pupil.lastName, { ca: 15, caMax: 20, exam: 50, examMax: 80 });
            expect(response.ok(), `status ${response.status()}`).toBeTruthy();
            const saved = (await response.json()).data;
            ids[`record${key}`] = saved.id;
            ids[`enrollment${key}`] = saved.studentEnrollmentId;
            ids.term = saved.termId;
        }

        for (const username of [ama.email, kofi.email, guardianA.phoneNumber]) {
            await (await signInAndSetPassword(browser, username, PASSWORD)).close();
        }
    });

    const reportUrl = (s: ApiSession, who: 'A' | 'B') =>
        `${s.academics}/grade-records/report?enrollmentId=${who === 'A' ? ids.enrollmentA : ids.enrollmentB}&termId=${ids.term}`;
    const pdfUrl = (s: ApiSession, who: 'A' | 'B') =>
        `${s.academics}/grade-records/report/pdf?studentId=${who === 'A' ? ids.childA : ids.childB}&classId=${who === 'A' ? ids.classA : ids.classB}&termId=${ids.term}`;
    const bulk = (s: ApiSession, ...who: ('A' | 'B')[]) =>
        s.send('POST', `${s.academics}/grade-records/report/pdf/bulk`, { termId: ids.term, studentIds: who.map(w => (w === 'A' ? ids.childA : ids.childB)) });
    const reportBody = (who: 'A' | 'B', extra: Record<string, unknown> = {}) =>
        ({ enrollmentId: who === 'A' ? ids.enrollmentA : ids.enrollmentB, termId: ids.term, status: 'DRAFT', teacherRemarks: who === 'A' ? remarkA : remarkB, ...extra });

    /** Every way to ask for one student's report card; each must be refused and none may leak the remark. */
    async function expectReportRefused(s: ApiSession, who: 'A' | 'B', secret: string) {
        const reads: Record<string, ApiResult> = {
            'report': await s.get(reportUrl(s, who)),
            'report pdf': await s.get(pdfUrl(s, who)),
            'bulk pdf': await bulk(s, who),
        };
        for (const [name, r] of Object.entries(reads)) {
            expect.soft(REFUSED, `${name}: ${r.status} ${r.body.slice(0, 160)}`).toContain(r.status);
            expect.soft(payloadOf(r.body), `${name} leaked the remark`).not.toContain(secret);
        }
    }

    test('the class teachers write their own class\'s report card', async ({ browser }) => {
        for (const [who, open] of [['A', asAma], ['B', asKofi]] as const) {
            const t = await open(browser);
            const r = await t.send('POST', `${t.academics}/grade-records/report`, reportBody(who));
            await t.close();
            expect(r.status, r.body.slice(0, 200)).toBe(201);
            ids[`report${who}`] = JSON.parse(r.body).data.id;
        }
    });

    test.describe('a parent', () => {
        test('cannot read another family\'s child\'s report card, in any form', async ({ browser }) => {
            const p = await asParentA(browser);
            await expectReportRefused(p, 'B', remarkB);
            await p.close();
        });

        test('cannot read their own child\'s report card while it is a draft', async ({ browser }) => {
            const p = await asParentA(browser);
            await expectReportRefused(p, 'A', remarkA);
            await p.close();
        });

        test('cannot write a report card, not even their own child\'s', async ({ browser }) => {
            const p = await asParentA(browser);
            const create = await p.send('POST', `${p.academics}/grade-records/report`, reportBody('A', { teacherRemarks: 'tampered' }));
            const edit = await p.send('PATCH', `${p.academics}/grade-records/report/${ids.reportA}`, reportBody('A', { teacherRemarks: 'tampered' }));
            await p.close();

            for (const r of [create, edit]) {
                expect(WRITE_REFUSED, r.body.slice(0, 160)).toContain(r.status);
            }
        });
    });

    test.describe('a teacher', () => {
        test('control: the teacher of class A can read class A\'s report card, as a single report and as a PDF request', async ({ browser }) => {
            // the refusals below must not pass just because every report read is refused
            const t = await asAma(browser);
            const one = await t.get(reportUrl(t, 'A'));
            const many = await bulk(t, 'A');
            await t.close();

            expect(one.status, one.body.slice(0, 160)).toBe(200);
            expect(payloadOf(one.body)).toContain(remarkA);
            expect(REFUSED, `bulk pdf: ${many.body.slice(0, 160)}`).not.toContain(many.status);
            expect(many.status, many.body.slice(0, 160)).toBeLessThan(500);
        });

        test('cannot read the report card of a class they do not teach, in any form', async ({ browser }) => {
            const t = await asKofi(browser);
            await expectReportRefused(t, 'A', remarkA);
            await t.close();
        });

        test('cannot write the report card of a class they do not teach', async ({ browser }) => {
            const t = await asKofi(browser);
            const create = await t.send('POST', `${t.academics}/grade-records/report`, reportBody('A', { teacherRemarks: 'tampered' }));
            const edit = await t.send('PATCH', `${t.academics}/grade-records/report/${ids.reportA}`, reportBody('A', { teacherRemarks: 'tampered' }));
            await t.close();

            for (const r of [create, edit]) {
                expect(WRITE_REFUSED, r.body.slice(0, 160)).toContain(r.status);
            }
        });

        test('class A\'s report card is untouched by the attempts above', async ({ browser }) => {
            const t = await asAma(browser);
            const r = await t.get(reportUrl(t, 'A'));
            await t.close();

            expect(r.status, r.body.slice(0, 160)).toBe(200);
            expect(payloadOf(r.body)).toContain(remarkA);
            expect(payloadOf(r.body)).not.toContain('tampered');
        });

        test('control: the teacher of class A can change class A\'s report card', async ({ browser }) => {
            const t = await asAma(browser);
            const r = await t.send('PATCH', `${t.academics}/grade-records/report/${ids.reportA}`, reportBody('A', { teacherRemarks: 'Updated by the class teacher' }));
            await t.close();

            expect(r.status, r.body.slice(0, 200)).toBe(200);
        });
    });
});

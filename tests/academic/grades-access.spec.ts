import { Browser } from '@playwright/test';
import { authenticatedTest as test, expect } from '../fixtures';
import { ApiSession, openApiSession, payloadOf } from '../helpers/api';
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
 * Who can read and change grades through the API. Grades are the most sensitive records the school
 * holds, so the same rules as enrolment apply, only stricter:
 *  - a parent never sees another family's child, and never a whole class's results
 *  - a teacher works on the classes and courses they teach, not on everyone's
 *  - a parent cannot change a score
 *
 * Class A (teacher Ama, family A) and class B (teacher Kofi, family B) each have one scored student.
 */
const PASSWORD = 'Newpass#12345';
const tag = Date.now().toString(36);
const classA = `Marks A ${tag}`;
const classB = `Marks B ${tag}`;
const courseA = `Algebraic ${tag}`;
const courseB = `Botanical ${tag}`;
const ama = makeStaff({ employeeType: 'Teacher' }); // class teacher and course teacher of class A
const kofi = makeStaff({ employeeType: 'Teacher' }); // class teacher and course teacher of class B
const childA = makeStudent();
const childB = makeStudent();
const guardianA = makeGuardian({ isPrimary: true });
const guardianB = makeGuardian({ isPrimary: true });
const nameOf = (t: { firstName: string; lastName: string }) => `${t.firstName} ${t.lastName}`;

const ids = { classA: 0, classB: 0, ccA: 0, ccB: 0, childA: 0, childB: 0, recordA: 0, recordB: 0, enrollmentA: 0, enrollmentB: 0, term: 0 };
let editPayload: Record<string, unknown> = {};

const REFUSED = [401, 403, 404];
const WRITE_REFUSED = [401, 403, 404];

const asParentA = (browser: Browser) => openApiSession(browser, guardianA.phoneNumber, PASSWORD);
const asAma = (browser: Browser) => openApiSession(browser, ama.email, PASSWORD);
const asKofi = (browser: Browser) => openApiSession(browser, kofi.email, PASSWORD);

/** Everything a stranger could ask for about one student and one class, given the ids. */
const readsAbout = (s: ApiSession, who: { student: number; classId: number; classCourse: number; record: number; enrollment: number }) => ({
    'grade list by student': `${s.academics}/grade-records/student?studentId=${who.student}`,
    'grade list by class course': `${s.academics}/grade-records/student?classCourseId=${who.classCourse}`,
    'one grade record': `${s.academics}/grade-records/${who.record}`,
    'report sheet': `${s.academics}/grade-records/report-sheet?studentId=${who.student}&classId=${who.classId}&termId=${ids.term}`,
    'master sheet': `${s.academics}/grade-records/master-sheet?classId=${who.classId}&termId=${ids.term}`,
});

const A = () => ({ student: ids.childA, classId: ids.classA, classCourse: ids.ccA, record: ids.recordA, enrollment: ids.enrollmentA });
const B = () => ({ student: ids.childB, classId: ids.classB, classCourse: ids.ccB, record: ids.recordB, enrollment: ids.enrollmentB });

async function expectNothingLeaks(session: ApiSession, requests: Record<string, string>, secrets: string[]) {
    for (const [name, url] of Object.entries(requests)) {
        const r = await session.get(url);
        // soft: report every endpoint that answers, not just the first one
        expect.soft(REFUSED, `${name}: ${r.status} ${r.body.slice(0, 160)}`).toContain(r.status);
        for (const secret of secrets) {
            expect.soft(payloadOf(r.body), `${name} leaked ${secret}`).not.toContain(secret);
        }
    }
}

test.describe.serial('Grades — who can read and change them', () => {
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
            if (key === 'A') editPayload = response.request().postDataJSON();
        }

        for (const username of [ama.email, kofi.email, guardianA.phoneNumber]) {
            await (await signInAndSetPassword(browser, username, PASSWORD)).close();
        }
    });

    test.describe('a parent', () => {
        test('cannot read another family\'s child, in any form', async ({ browser }) => {
            const p = await asParentA(browser);
            await expectNothingLeaks(p, readsAbout(p, B()), [childB.lastName, classB, courseB, nameOf(kofi)]);
            await p.close();
        });

        test('cannot read a whole class\'s results, not even their own child\'s class', async ({ browser }) => {
            const p = await asParentA(browser);
            const ownClass = await p.get(`${p.academics}/grade-records/master-sheet?classId=${ids.classA}&termId=${ids.term}`);
            const ownClassList = await p.get(`${p.academics}/grade-records/student?classCourseId=${ids.ccA}`);
            await p.close();

            for (const r of [ownClass, ownClassList]) {
                expect(REFUSED, r.body.slice(0, 160)).toContain(r.status);
            }
        });

        // Report PDFs and the published student reports are checked in the publication spec: they only
        // exist once a class's results are published, and a request before that proves nothing.

        test('cannot change a score, not even their own child\'s', async ({ browser }) => {
            const p = await asParentA(browser);
            const own = await p.send('PATCH', `${p.academics}/grade-records/${ids.recordA}`, { ...editPayload, continuousAssessmentScore: 20, remarks: 'tampered' });
            const other = await p.send('PATCH', `${p.academics}/grade-records/${ids.recordB}`, { ...editPayload, continuousAssessmentScore: 20, remarks: 'tampered' });
            await p.close();

            for (const r of [own, other]) {
                expect(WRITE_REFUSED, r.body.slice(0, 160)).toContain(r.status);
            }
        });
    });

    test.describe('a teacher', () => {
        test('control: the teacher of class A can read class A\'s grades', async ({ browser }) => {
            // the refusals below must not pass just because every grade read is refused
            const t = await asAma(browser);
            const list = await t.get(`${t.academics}/grade-records/student?classCourseId=${ids.ccA}`);
            const one = await t.get(`${t.academics}/grade-records/${ids.recordA}`);
            await t.close();

            expect(list.status, list.body.slice(0, 160)).toBe(200);
            expect(payloadOf(list.body)).toContain(childA.lastName);
            expect(one.status, one.body.slice(0, 160)).toBe(200);
        });

        test('cannot read the grades of a class they do not teach', async ({ browser }) => {
            const t = await asKofi(browser);
            await expectNothingLeaks(t, readsAbout(t, A()), [childA.lastName, classA, courseA, nameOf(ama)]);
            await t.close();
        });

        test('cannot change the scores of a class they do not teach', async ({ browser }) => {
            const t = await asKofi(browser);
            const r = await t.send('PATCH', `${t.academics}/grade-records/${ids.recordA}`, { ...editPayload, continuousAssessmentScore: 20, remarks: 'tampered' });
            await t.close();

            expect(WRITE_REFUSED, r.body.slice(0, 160)).toContain(r.status);
        });

        test('class A\'s scores are untouched by the attempts above', async ({ page }) => {
            // checked before the class teacher's own edit below, which would hide any tampering
            const grades = new GradeRecordPage(page);
            await grades.visit(ids.ccA);

            await grades.openRecord(childA.lastName);

            await expect(page.locator('mat-dialog-container textarea[formcontrolname="remarks"]')).not.toHaveValue('tampered');
            await expect(page.locator('mat-dialog-container [formcontrolname="continuousAssessmentScore"]')).toHaveValue('15');
            await grades.cancelDialog();
        });

        test('control: the teacher of class A can change class A\'s scores', async ({ browser }) => {
            const t = await asAma(browser);
            const r = await t.send('PATCH', `${t.academics}/grade-records/${ids.recordA}`, { ...editPayload, remarks: 'Updated by the class teacher' });
            await t.close();

            expect(r.status, r.body.slice(0, 200)).toBe(200);
        });
    });

    test('the class teacher\'s own edit is saved', async ({ page }) => {
        const grades = new GradeRecordPage(page);
        await grades.visit(ids.ccA);

        await grades.openRecord(childA.lastName);
        await expect(page.locator('mat-dialog-container textarea[formcontrolname="remarks"]')).toHaveValue('Updated by the class teacher');
        await expect(page.locator('mat-dialog-container [formcontrolname="continuousAssessmentScore"]')).toHaveValue('15');
        await grades.cancelDialog();
    });
});

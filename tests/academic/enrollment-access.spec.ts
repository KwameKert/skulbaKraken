import { Browser } from '@playwright/test';
import { authenticatedTest as test, expect } from '../fixtures';
import { createClass } from '../helpers/classes';
import { ApiSession, openApiSession, payloadOf } from '../helpers/api';
import { signInAndSetPassword } from '../helpers/session';
import { createChild, enrol } from '../helpers/students';
import { EnrollmentPage } from '../pages/EnrollmentPage';
import { StaffPage } from '../pages/StaffPage';
import { StudentsPage } from '../pages/StudentsPage';
import { makeGuardian, makeStaff, makeStudent } from '../data/people';

/**
 * Who can read or change enrolments through the API. Enrolment decides who sits in which class, so:
 *  - only an administrator may enrol, bulk enrol, promote or withdraw anyone
 *  - a parent may read their own child's enrolment, never another family's, and never a class roster
 *  - a teacher who does not teach the class may not read its roster or its students' enrolments
 *
 * Family A and family B each have a child in their own class. The class teacher teaches class A only;
 * the other "teacher" teaches no class.
 */
const PASSWORD = 'Newpass#12345';
const tag = Date.now().toString(36);
const classA = `Access A ${tag}`;
const classB = `Access B ${tag}`;
const teacher = makeStaff({ employeeType: 'Teacher' });
const classTeacher = makeStaff({ employeeType: 'Teacher' });
const accountant = makeStaff({ employeeType: 'Accountant' });
const childA = makeStudent();
const childB = makeStudent();
const guardianA = makeGuardian({ isPrimary: true });
const guardianB = makeGuardian({ isPrimary: true });

const ids = { classA: 0, classB: 0, childA: 0, childB: 0, year: 0 };

const REFUSED = [401, 403, 404];
const WRITE_REFUSED = [401, 403]; // the role check runs before any lookup, so a 404 would prove nothing

const asParent = (browser: Browser) => openApiSession(browser, guardianA.phoneNumber, PASSWORD);
const asTeacher = (browser: Browser) => openApiSession(browser, teacher.email, PASSWORD);
const asClassTeacher = (browser: Browser) => openApiSession(browser, classTeacher.email, PASSWORD);
const asAccountant = (browser: Browser) => openApiSession(browser, accountant.email, PASSWORD);

test.describe.serial('Enrollment — who can read and change it', () => {
    test('sets up two families, a teacher with no class, a class teacher and an accountant', async ({ page, browser }) => {
        test.setTimeout(180_000);
        const staffPage = new StaffPage(page);
        for (const person of [teacher, classTeacher, accountant]) {
            await staffPage.visitAddForm();
            await staffPage.fillStaffForm(person);
            const [res] = await Promise.all([
                page.waitForResponse(r => r.url().includes('/employees') && r.request().method() === 'POST'),
                staffPage.submitForm(),
            ]);
            expect(res.ok(), `status ${res.status()}`).toBeTruthy();
        }

        ids.classA = await createClass(page, classA, 'ACTIVE', `${classTeacher.firstName} ${classTeacher.lastName}`);
        ids.classB = await createClass(page, classB);

        ids.childA = await createChild(page, childA, guardianA);
        ids.childB = await createChild(page, childB, guardianB);
        ids.year = await enrol(page, ids.childA, classA);
        await enrol(page, ids.childB, classB);

        // first logins force a password change; do them once so the tests below just sign in
        await (await signInAndSetPassword(browser, teacher.email, PASSWORD)).close();
        await (await signInAndSetPassword(browser, classTeacher.email, PASSWORD)).close();
        await (await signInAndSetPassword(browser, accountant.email, PASSWORD)).close();
        await (await signInAndSetPassword(browser, guardianA.phoneNumber, PASSWORD)).close();
    });

    test.describe('a parent reading enrolments', () => {
        test('can read their own child\'s enrolment', async ({ browser }) => {
            // control: the checks below must not pass just because every enrolment read is refused
            const p = await asParent(browser);
            const byYear = await p.get(`${p.academics}/enrollments/student/${ids.childA}/academic-year/${ids.year}`);
            await p.close();

            expect(byYear.status, byYear.body.slice(0, 200)).toBe(200);
            expect(payloadOf(byYear.body)).toContain(classA);
        });

        test('cannot read another family\'s child enrolment', async ({ browser }) => {
            const p = await asParent(browser);
            const results = {
                'by student': await p.get(`${p.academics}/enrollments/student/${ids.childB}`),
                'by year': await p.get(`${p.academics}/enrollments/student/${ids.childB}/academic-year/${ids.year}`),
                'history': await p.get(`${p.academics}/enrollments/studentEnrollmentList/${ids.childB}`),
            };
            await p.close();

            for (const [name, r] of Object.entries(results)) {
                expect(REFUSED, `${name}: ${r.body.slice(0, 200)}`).toContain(r.status);
                expect(payloadOf(r.body), `${name} leaked`).not.toContain(classB);
            }
        });

        test('cannot read a class roster, their own child\'s class included', async ({ browser }) => {
            const p = await asParent(browser);
            const own = await p.get(`${p.academics}/enrollments/class/${ids.classA}/students`);
            const other = await p.get(`${p.academics}/enrollments/class/${ids.classB}/students`);
            await p.close();

            for (const r of [own, other]) {
                expect(REFUSED, r.body.slice(0, 200)).toContain(r.status);
            }
            expect(payloadOf(other.body)).not.toContain(childB.lastName);
        });
    });

    test.describe('a teacher who does not teach the class', () => {
        test('cannot read a class roster', async ({ browser }) => {
            const t = await asTeacher(browser);
            const roster = await t.get(`${t.academics}/enrollments/class/${ids.classA}/students`);
            await t.close();

            expect(REFUSED, roster.body.slice(0, 200)).toContain(roster.status);
            expect(payloadOf(roster.body)).not.toContain(childA.lastName);
        });

        test('cannot read a student\'s enrolment', async ({ browser }) => {
            const t = await asTeacher(browser);
            const results = {
                'by student': await t.get(`${t.academics}/enrollments/student/${ids.childA}`),
                'by year': await t.get(`${t.academics}/enrollments/student/${ids.childA}/academic-year/${ids.year}`),
                'history': await t.get(`${t.academics}/enrollments/studentEnrollmentList/${ids.childA}`),
            };
            await t.close();

            for (const [name, r] of Object.entries(results)) {
                expect(REFUSED, `${name}: ${r.body.slice(0, 200)}`).toContain(r.status);
                expect(payloadOf(r.body), `${name} leaked`).not.toContain(classA);
            }
        });
    });

    test.describe('the teacher of class A', () => {
        // control for the teacher checks above: being the class teacher is what unlocks access
        test('can read their own class roster and its students\' enrolments', async ({ browser }) => {
            const t = await asClassTeacher(browser);
            const roster = await t.get(`${t.academics}/enrollments/class/${ids.classA}/students`);
            const byYear = await t.get(`${t.academics}/enrollments/student/${ids.childA}/academic-year/${ids.year}`);
            const history = await t.get(`${t.academics}/enrollments/studentEnrollmentList/${ids.childA}`);
            await t.close();

            expect(roster.status, roster.body.slice(0, 200)).toBe(200);
            expect(payloadOf(roster.body)).toContain(childA.lastName);
            expect(byYear.status, byYear.body.slice(0, 200)).toBe(200);
            expect(payloadOf(byYear.body)).toContain(classA);
            expect(history.status, history.body.slice(0, 200)).toBe(200);
        });

        test('cannot read another class\'s roster or its students\' enrolments', async ({ browser }) => {
            const t = await asClassTeacher(browser);
            const roster = await t.get(`${t.academics}/enrollments/class/${ids.classB}/students`);
            const byYear = await t.get(`${t.academics}/enrollments/student/${ids.childB}/academic-year/${ids.year}`);
            await t.close();

            for (const r of [roster, byYear]) {
                expect(REFUSED, r.body.slice(0, 200)).toContain(r.status);
            }
            expect(payloadOf(roster.body)).not.toContain(childB.lastName);
            expect(payloadOf(byYear.body)).not.toContain(classB);
        });
    });

    test.describe('an accountant', () => {
        // fees depend on who is in which class, so any student's enrolment is readable; rosters are not
        test('can read any student\'s enrolment', async ({ browser }) => {
            const a = await asAccountant(browser);
            const results = {
                'by student': await a.get(`${a.academics}/enrollments/student/${ids.childB}`),
                'by year': await a.get(`${a.academics}/enrollments/student/${ids.childA}/academic-year/${ids.year}`),
                'history': await a.get(`${a.academics}/enrollments/studentEnrollmentList/${ids.childB}`),
            };
            await a.close();

            for (const [name, r] of Object.entries(results)) {
                expect(r.status, `${name}: ${r.body.slice(0, 200)}`).toBe(200);
            }
            expect(payloadOf(results['by year'].body)).toContain(classA);
        });

        test('cannot read a class roster', async ({ browser }) => {
            const a = await asAccountant(browser);
            const roster = await a.get(`${a.academics}/enrollments/class/${ids.classA}/students`);
            await a.close();

            expect(REFUSED, roster.body.slice(0, 200)).toContain(roster.status);
            expect(payloadOf(roster.body)).not.toContain(childA.lastName);
        });
    });

    for (const who of ['parent', 'teacher'] as const) {
        test.describe(`a ${who} changing enrolments`, () => {
            const open = (browser: Browser): Promise<ApiSession> => (who === 'parent' ? asParent(browser) : asTeacher(browser));
            // a complete, valid payload, so only the role check can refuse it
            const enrolment = () => ({ studentId: ids.childA, schoolClassId: ids.classB, academicYearId: ids.year });

            test('cannot enrol, bulk enrol, promote or withdraw', async ({ browser }) => {
                const s = await open(browser);
                const results = {
                    enrol: await s.send('POST', `${s.academics}/enrollments`, enrolment()),
                    bulk: await s.send('POST', `${s.academics}/enrollments/bulk`, [enrolment()]),
                    promote: await s.send('POST', `${s.academics}/enrollments/promotion`, [enrolment()]),
                    withdraw: await s.send('POST', `${s.academics}/enrollments/student/${ids.childA}/withdraw`),
                };
                await s.close();

                for (const [name, r] of Object.entries(results)) {
                    expect(WRITE_REFUSED, `${name}: ${r.body.slice(0, 200)}`).toContain(r.status);
                }
            });
        });
    }

    test('nothing was changed: each child is still active in their own class only', async ({ page }) => {
        const enrollment = new EnrollmentPage(page);

        await enrollment.visit(ids.childA);
        await expect(enrollment.rows).toHaveCount(1);
        await enrollment.expectStatus(classA, 'ACTIVE');

        await enrollment.visit(ids.childB);
        await expect(enrollment.rows).toHaveCount(1);
        await enrollment.expectStatus(classB, 'ACTIVE');
    });
});

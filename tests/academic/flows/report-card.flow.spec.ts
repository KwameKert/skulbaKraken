import { authenticatedTest as test, expect } from '../../fixtures';
import { getLoginCredentials } from '../../data/credentials';
import { ApiSession, openApiSession } from '../../helpers/api';
import { buildClassroom, Classroom } from '../../helpers/classroom';
import { makeStaff } from '../../data/people';
import { signIn, signInAndSetPassword } from '../../helpers/session';
import { ParentPortalPage } from '../../pages/ParentPortalPage';
import { GradeBand, GradeScalePage, letterFor, STANDARD_SCALE } from '../../pages/GradeScalePage';
import { GradeRecordPage } from '../../pages/GradeRecordPage';
import { MasterSheetPage } from '../../pages/MasterSheetPage';
import { ReportTemplatePage } from '../../pages/ReportTemplatePage';
import { StaffPage } from '../../pages/StaffPage';
import { TermDetailPage } from '../../pages/TermDetailPage';

/**
 * From scores to the master sheet. A class with three courses and four students is scored through the
 * course pages, then the master sheet is checked twice: the API response, and what the screen shows.
 * Both are compared with figures this file works out for itself from the scores it entered:
 *   course total = weighted CA + weighted exam   (CA out of 20 at 40%, exam out of 80 at 60%)
 *   row total    = the sum of the course totals
 *   position     = by row total, highest first; equal totals share a position and the next one skips ahead
 *
 * Then the report cards behind the master sheet's Report button: what the dialog shows, and who can
 * write which remarks (an administrator both, the class teacher only their own, a head teacher both).
 *
 * Finally the class's results are published from the term screen: every student gets a published report
 * card with their positions, nothing can be changed afterwards, parents can read their own child's card
 * and nobody else's, and unpublishing takes the cards back.
 *
 * The scores are chosen to exercise the rules, not to be realistic:
 *   Kofi   scores high everywhere
 *   Esi    and Yaw have identical scores, so they tie
 *   Efua   has no English score at all, which the sheet must show as nothing scored, not hide
 */
const tag = Date.now().toString(36);
const courseNames = [`Maths ${tag}`, `English ${tag}`, `Science ${tag}`];
const CA_MAX = 20;
const EXAM_MAX = 80;
const CA_WEIGHT = 40;
const EXAM_WEIGHT = 60;

type Entry = { ca: number; exam: number } | null;
const NAMES = ['Kofi', 'Esi', 'Yaw', 'Efua'] as const;
/** scores[pupil][course]: null means nothing is entered, so the record keeps its zeros */
const scores: Entry[][] = [
    [{ ca: 18, exam: 72 }, { ca: 16, exam: 64 }, { ca: 20, exam: 80 }],
    [{ ca: 10, exam: 40 }, { ca: 14, exam: 56 }, { ca: 12, exam: 48 }],
    [{ ca: 10, exam: 40 }, { ca: 14, exam: 56 }, { ca: 12, exam: 48 }],
    [{ ca: 8, exam: 32 }, null, { ca: 6, exam: 24 }],
];

const round1 = (n: number) => Math.round(n * 10) / 10;
const courseTotal = (entry: Entry) =>
    entry ? round1(round1(entry.ca / CA_MAX * CA_WEIGHT) + round1(entry.exam / EXAM_MAX * EXAM_WEIGHT)) : 0;

interface ExpectedRow {
    pupil: number;
    perCourse: number[];
    total: number;
    position: number;
}

/** What the sheet should say for the scores as they stand now, best first. */
function expectedSheet(): ExpectedRow[] {
    const rows = scores.map((entries, pupil) => {
        const perCourse = entries.map(courseTotal);
        return { pupil, perCourse, total: round1(perCourse.reduce((a, b) => a + b, 0)), position: 0 };
    });
    rows.sort((a, b) => b.total - a.total);
    rows.forEach((row, i) => {
        row.position = i > 0 && row.total === rows[i - 1].total ? rows[i - 1].position : i + 1;
    });
    return rows;
}

const ordinal = (n: number) => {
    const teen = n % 100 >= 11 && n % 100 <= 13;
    return `${n}${teen ? 'th' : ({ 1: 'st', 2: 'nd', 3: 'rd' } as Record<number, string>)[n % 10] ?? 'th'}`;
};

const PASSWORD = 'Newpass#12345';
const TEMPLATE = 'E2E Report Template';
const headTeacher = makeStaff({ employeeType: 'Head Teacher' });
const remarks = {
    teacher: `Works steadily and asks good questions ${tag}`,
    head: `Promoted with distinction ${tag}`,
    teacherRevised: `Has grown in confidence this term ${tag}`,
    headRevised: `Congratulations on a strong term ${tag}`,
};

/** Each student's position in one course: by that course's total, ties sharing a position. */
function expectedSubjectPositions(course: number): number[] {
    const totals = scores.map(entries => courseTotal(entries[course]));
    return totals.map(total => 1 + totals.filter(other => other > total).length);
}

/** Signs a parent in as themselves and opens their End of Term page. */
async function parentOnEndOfTerm(browser: import('@playwright/test').Browser, pupil = 0) {
    const session = await signIn(browser, room.pupils[pupil].guardian.phoneNumber, PASSWORD);
    await session.page.waitForURL(/\/dashboard/);
    const portal = new ParentPortalPage(session.page);
    await portal.selectChild(room.pupils[pupil].student.lastName);
    await portal.openEndOfTerm();
    return { session, portal };
}

let room: Classroom;
let scale: GradeBand[] = [];
let termId = 0;
let termName = '';
let admin: ApiSession;
const enrollmentIds: number[] = [];
let reportId = 0;

/** The sheet as the API returns it, in the order it returns it. */
async function sheetFromApi() {
    const response = await admin.get(`${admin.academics}/grade-records/master-sheet?classId=${room.classId}&termId=${termId}`);
    expect(response.status, response.body.slice(0, 200)).toBe(200);
    return JSON.parse(response.body).data as { studentName: string; subjectGrades: Record<string, number>; totalScore: number; position: number }[];
}

/** A student's saved report card as the API returns it. */
async function reportFromApi(pupil: number) {
    const response = await admin.get(`${admin.academics}/grade-records/report?enrollmentId=${enrollmentIds[pupil]}&termId=${termId}`);
    expect(response.status, response.body.slice(0, 200)).toBe(200);
    return JSON.parse(response.body).data as { id: number; status: string; teacherRemarks: string; headMasterRemarks: string };
}

function checkApiSheet(sheet: Awaited<ReturnType<typeof sheetFromApi>>) {
    const expected = expectedSheet();
    expect(sheet, 'one row per enrolled student').toHaveLength(NAMES.length);
    expect(sheet.map(r => r.totalScore), 'best first').toEqual([...sheet.map(r => r.totalScore)].sort((a, b) => b - a));
    expected.forEach(want => {
        // rows are matched by student: the order inside a tie is not promised
        const got = sheet.find(r => r.studentName.includes(room.pupils[want.pupil].student.lastName))!;
        const who = NAMES[want.pupil];
        expect(got, `${who} is on the sheet`).toBeTruthy();
        expect(Object.keys(got.subjectGrades).sort(), `${who}: courses`).toEqual([...courseNames].sort());
        courseNames.forEach((course, c) => {
            expect(got.subjectGrades[course], `${who}: ${course}`).toBeCloseTo(want.perCourse[c], 1);
        });
        expect(got.totalScore, `${who}: total`).toBeCloseTo(want.total, 1);
        expect(got.position, `${who}: position`).toBe(want.position);
    });
}

/** The same figures as the screen writes them: a zero shows as N/A, positions as 1st, 2nd... */
async function checkScreenSheet(page: import('@playwright/test').Page) {
    const sheet = new MasterSheetPage(page);
    await sheet.open(room.className);
    const headers = await sheet.headers();
    // Student first, then the courses (in whatever order the API lists them), then Position, Total and Action
    expect(headers[0]).toBe('Student');
    expect(headers.slice(1, -3).sort(), 'one column per course').toEqual([...courseNames].sort());
    expect(headers.slice(-3), 'closing columns').toEqual(['Position', 'Total', 'Action']);
    const rows = await sheet.rows();
    const expected = expectedSheet();
    expect(rows, 'one row per enrolled student').toHaveLength(NAMES.length);
    expect(rows.map(r => Number(r.total)), 'best first').toEqual([...rows.map(r => Number(r.total))].sort((a, b) => b - a));
    expected.forEach(want => {
        const got = rows.find(r => r.student.includes(room.pupils[want.pupil].student.lastName))!;
        const who = NAMES[want.pupil];
        expect(got, `${who} is on the sheet`).toBeTruthy();
        courseNames.forEach((course, c) => {
            const value = want.perCourse[c];
            expect(got.scores[course], `${who}: ${course}`).toBe(value === 0 ? 'N/A' : String(value));
        });
        expect(got.position, `${who}: position`).toBe(ordinal(want.position));
        expect(got.total, `${who}: total`).toBe(String(want.total));
    });
}

async function enterScores(page: import('@playwright/test').Page, wanted: { pupil: number; course: number }[]) {
    const grades = new GradeRecordPage(page);
    for (const { pupil, course } of wanted) {
        const entry = scores[pupil][course];
        if (!entry) continue;
        await grades.visit(room.courses[course].classCourseId);
        const response = await grades.record(room.pupils[pupil].student.lastName, { ca: entry.ca, caMax: CA_MAX, exam: entry.exam, examMax: EXAM_MAX });
        expect(response.ok(), `${NAMES[pupil]} / ${courseNames[course]}: status ${response.status()}`).toBeTruthy();
        const saved = (await response.json()).data;
        termId = saved.termId;
        termName = saved.termName;
        enrollmentIds[pupil] = saved.studentEnrollmentId;
    }
}

test.describe.serial('Report card flow: scores to master sheet', { tag: '@flow' }, () => {
    test('builds a class with three courses and four enrolled students', async ({ page }) => {
        test.setTimeout(480_000);
        // the grade letters on the report cards come from this scale, applied as each score is saved
        scale = await new GradeScalePage(page).ensureScale(STANDARD_SCALE);
        room = await buildClassroom(page, { tag, courseNames, students: NAMES.length });
        expect(room.courses).toHaveLength(courseNames.length);
        expect(room.pupils).toHaveLength(NAMES.length);
    });

    test('scores every student on every course, except the one left unscored', async ({ page }) => {
        test.setTimeout(300_000);
        const everything = scores.flatMap((_, pupil) => courseNames.map((_, course) => ({ pupil, course })));
        await enterScores(page, everything);
        expect(termId).toBeGreaterThan(0);
    });

    test('the master sheet API has every student, every course, the right totals and positions', async ({ browser }) => {
        const { email, password } = getLoginCredentials();
        admin = await openApiSession(browser, email, password);
        const sheet = await sheetFromApi();
        checkApiSheet(sheet);
        // the tie: both get the same position, and the next student skips ahead (1, 2, 2, 4)
        expect(sheet.map(r => r.position)).toEqual([1, 2, 2, 4]);
    });

    test('the master sheet screen shows the same figures', async ({ page }) => {
        await checkScreenSheet(page);
    });

    test('a course that was never scored counts as zero, not as a missing course', async () => {
        const sheet = await sheetFromApi();
        const efua = sheet.find(r => r.studentName.includes(room.pupils[3].student.lastName))!;
        expect(Object.keys(efua.subjectGrades)).toContain(courseNames[1]);
        expect(efua.subjectGrades[courseNames[1]]).toBe(0);
    });

    test('a late score moves the student up the sheet, on the API and on the screen', async ({ page }) => {
        test.setTimeout(240_000);
        // Efua's English was missing, and her Maths was low: both are now full marks
        scores[3][0] = { ca: 20, exam: 80 };
        scores[3][1] = { ca: 20, exam: 80 };
        await enterScores(page, [{ pupil: 3, course: 0 }, { pupil: 3, course: 1 }]);

        const sheet = await sheetFromApi();
        checkApiSheet(sheet);
        expect(sheet.map(r => r.position), 'Efua is now second, and the tie drops to third').toEqual([1, 2, 3, 3]);
        await checkScreenSheet(page);
    });
    test.describe('the Report button on the master sheet', () => {
        test('shows the student\'s term, class and every course with its scores, total and grade', async ({ page }) => {
            const sheet = new MasterSheetPage(page);
            await sheet.open(room.className);
            const report = await sheet.openReport(room.pupils[0].student.lastName);

            const perCourse = scores[0].map(courseTotal);
            expect(await report.headerValue('Student Name:')).toContain(room.pupils[0].student.lastName);
            expect(await report.headerValue('Class:')).toBe(room.className);
            // the term name arrives with its own request, after the dialog is already open
            await expect.poll(() => report.headerValue('Term:'), { message: 'the term is named' }).not.toBe('');
            expect(await report.headerValue('Total Score:'), 'total out of 100 per course')
                .toBe(`${round1(perCourse.reduce((a, b) => a + b, 0))} / ${courseNames.length * 100}`);

            const shown = (await report.subjects()).sort((a, b) => a.subject.localeCompare(b.subject));
            const wanted = courseNames.map((name, c) => ({
                subject: name,
                // the dialog lists the raw scores that were typed in, then the weighted total
                classScore: String(scores[0][c]!.ca),
                examScore: String(scores[0][c]!.exam),
                total: String(perCourse[c]),
                grade: letterFor(scale, perCourse[c]),
            })).sort((a, b) => a.subject.localeCompare(b.subject));
            expect(shown).toEqual(wanted);
            await report.cancel();
        });

        test('a student with no report card yet opens empty remarks for an administrator to fill', async ({ page }) => {
            const sheet = new MasterSheetPage(page);
            await sheet.open(room.className);
            const report = await sheet.openReport(room.pupils[0].student.lastName);

            await expect(report.teacherEditor(), 'an administrator can write teacher remarks').toHaveCount(1);
            await expect(report.headTeacherEditor(), 'and head teacher remarks').toHaveCount(1);
            expect(await report.teacherRemarks()).toBe('');
            expect(await report.headTeacherRemarks()).toBe('');
            await report.cancel();
        });

        test('the first save creates the report card as a draft with both remarks', async ({ page }) => {
            const sheet = new MasterSheetPage(page);
            await sheet.open(room.className);
            const report = await sheet.openReport(room.pupils[0].student.lastName);
            await report.writeTeacherRemarks(remarks.teacher);
            await report.writeHeadTeacherRemarks(remarks.head);

            const response = await report.save();
            expect(response.status(), await response.text()).toBe(201);
            const created = (await response.json()).data;
            expect(created.status).toBe('DRAFT');
            reportId = created.id;
            const sent = response.request().postDataJSON();
            expect(sent.teacherRemarks, 'the screen sends what was typed').toContain(remarks.teacher);
            expect(sent.headMasterRemarks, 'the screen sends what was typed').toContain(remarks.head);
            await sheet.expectToastMessage(/report card updated successfully/i);

            const stored = await reportFromApi(0);
            expect(stored.id).toBe(reportId);
            expect(stored.status).toBe('DRAFT');
            expect(stored.teacherRemarks).toContain(remarks.teacher);
            expect(stored.headMasterRemarks).toContain(remarks.head);
        });

        test('opening the report again shows what was saved', async ({ page }) => {
            const sheet = new MasterSheetPage(page);
            await sheet.open(room.className);
            const report = await sheet.openReport(room.pupils[0].student.lastName);

            expect(await report.teacherRemarks()).toContain(remarks.teacher);
            expect(await report.headTeacherRemarks()).toContain(remarks.head);
            await report.cancel();
        });

        test('saving again updates the same report card instead of making another', async ({ page }) => {
            const sheet = new MasterSheetPage(page);
            await sheet.open(room.className);
            const report = await sheet.openReport(room.pupils[0].student.lastName);
            await report.writeTeacherRemarks(remarks.teacherRevised);

            const response = await report.save();
            expect(response.status(), await response.text()).toBe(200);
            expect((await response.json()).data.id).toBe(reportId);

            const stored = await reportFromApi(0);
            expect(stored.id, 'still one report card').toBe(reportId);
            expect(stored.teacherRemarks).toContain(remarks.teacherRevised);
            expect(stored.teacherRemarks).not.toContain(remarks.teacher);
            expect(stored.headMasterRemarks, 'the head teacher\'s remarks are not lost').toContain(remarks.head);
        });

        test('another student\'s report card is not touched', async ({ page }) => {
            const sheet = new MasterSheetPage(page);
            await sheet.open(room.className);
            const report = await sheet.openReport(room.pupils[1].student.lastName);

            expect(await report.teacherRemarks()).toBe('');
            expect(await report.headTeacherRemarks()).toBe('');
            await report.cancel();
        });
    });

    test.describe('who can write which remarks', () => {
        test('the class teacher writes the teacher remarks and sees the head teacher\'s as read-only', async ({ browser }) => {
            test.setTimeout(180_000);
            const session = await signInAndSetPassword(browser, room.teacher.email, PASSWORD);
            const sheet = new MasterSheetPage(session.page);
            await sheet.open(room.className);
            const report = await sheet.openReport(room.pupils[0].student.lastName);

            await expect(report.teacherEditor(), 'the teacher can write their own remarks').toHaveCount(1);
            await expect(report.headTeacherEditor(), 'but not the head teacher\'s').toHaveCount(0);
            expect(await report.headTeacherRemarks(), 'which they can still read').toContain(remarks.head);

            await report.writeTeacherRemarks(remarks.teacher);
            const response = await report.save();
            expect(response.status(), await response.text()).toBe(200);
            await session.close();

            const stored = await reportFromApi(0);
            expect(stored.teacherRemarks).toContain(remarks.teacher);
            expect(stored.headMasterRemarks, 'saving as a teacher must not wipe the head teacher\'s remarks').toContain(remarks.head);
        });

        test('a head teacher writes both', async ({ page, browser }) => {
            test.setTimeout(180_000);
            const staffPage = new StaffPage(page);
            await staffPage.visitAddForm();
            await staffPage.fillStaffForm(headTeacher);
            await Promise.all([
                page.waitForResponse(r => r.url().includes('/employees') && r.request().method() === 'POST'),
                staffPage.submitForm(),
            ]);

            const session = await signInAndSetPassword(browser, headTeacher.email, PASSWORD);
            const sheet = new MasterSheetPage(session.page);
            await sheet.open(room.className);
            const report = await sheet.openReport(room.pupils[0].student.lastName);

            await expect(report.teacherEditor()).toHaveCount(1);
            await expect(report.headTeacherEditor(), 'a head teacher can write the head teacher remarks').toHaveCount(1);
            await report.writeHeadTeacherRemarks(remarks.headRevised);
            const response = await report.save();
            expect(response.status(), await response.text()).toBe(200);
            await session.close();

            const stored = await reportFromApi(0);
            expect(stored.headMasterRemarks).toContain(remarks.headRevised);
            expect(stored.teacherRemarks, 'the class teacher\'s remarks are kept').toContain(remarks.teacher);
        });
    });
    test.describe('before publishing', () => {
        test('a parent sees no report card while it is still a draft, even though remarks are saved', async ({ browser }) => {
            test.setTimeout(180_000);
            // the first sign-in sets the parent's own password
            const first = await signInAndSetPassword(browser, room.pupils[0].guardian.phoneNumber, PASSWORD);
            await first.close();

            const { session, portal } = await parentOnEndOfTerm(browser);
            expect(await portal.reports(), 'a draft is not a report card').toEqual([]);
            await expect(portal.emptyNotice).toBeVisible();
            await session.close();
        });
    });

    test.describe('publishing the class\'s results', () => {
        let publishedBefore = 0;

        test('the school has a report template to publish with', async ({ page }) => {
            await new ReportTemplatePage(page).ensureTemplate(TEMPLATE);
        });

        test('an administrator publishes the class from the current term\'s page', async ({ page }) => {
            const detail = new TermDetailPage(page);
            await detail.openFromList(termName);
            await expect(detail.rowFor(room.className), 'nothing is published for this class yet').toHaveCount(0);
            publishedBefore = (await detail.counters()).published;

            const response = await detail.publish(room.className, TEMPLATE);
            expect(response.status(), await response.text()).toBe(200);
            const [publication] = (await response.json()).data;
            expect(publication.status).toBe('PUBLISHED');
            expect([publication.processedStudents, publication.totalStudents]).toEqual([NAMES.length, NAMES.length]);

            await detail.expectToastMessage(/reports published successfully/i);
            await expect(detail.rowFor(room.className)).toHaveCount(1);
            const row = await detail.publication(room.className);
            expect(row.status).toContain('PUBLISHED');
            expect(row.students).toBe(`${NAMES.length} / ${NAMES.length}`);
            expect(row.publishedBy, 'who published it is recorded').not.toBe('—');
            await expect.poll(async () => (await detail.counters()).published, { message: 'published reports on the term' })
                .toBe(publishedBefore + NAMES.length);
        });

        test('every student now has a published report card with their positions', async () => {
            const sheet = expectedSheet();
            for (const [pupil, student] of room.pupils.entries()) {
                const card = await reportFromApi(pupil);
                expect(card.status, `${NAMES[pupil]}: report status`).toBe('PUBLISHED');

                const response = await admin.get(`${admin.academics}/grade-records/report-sheet?studentId=${student.studentId}&classId=${room.classId}&termId=${termId}`);
                expect(response.status, response.body.slice(0, 200)).toBe(200);
                const published = JSON.parse(response.body).data;
                const want = sheet.find(r => r.pupil === pupil)!;
                expect(published.position, `${NAMES[pupil]}: class position`).toBe(want.position);
                expect(published.totalScore, `${NAMES[pupil]}: total`).toBeCloseTo(want.total, 1);

                expect(published.subjectGrades, `${NAMES[pupil]}: one line per course`).toHaveLength(courseNames.length);
                courseNames.forEach((course, c) => {
                    const line = published.subjectGrades.find((g: { subjectName: string }) => g.subjectName === course);
                    expect(line.totalScore, `${NAMES[pupil]} / ${course}: total`).toBeCloseTo(want.perCourse[c], 1);
                    expect(line.subjectPosition, `${NAMES[pupil]} / ${course}: subject position`).toBe(expectedSubjectPositions(c)[pupil]);
                });
            }
        });

        test('the remarks written before publishing are kept, and the other students\' cards have none', async () => {
            const kofi = await reportFromApi(0);
            expect(kofi.teacherRemarks).toContain(remarks.teacher);
            expect(kofi.headMasterRemarks).toContain(remarks.headRevised);
            for (const pupil of [1, 2, 3]) {
                const card = await reportFromApi(pupil);
                expect(card.teacherRemarks ?? '', `${NAMES[pupil]}: teacher remarks`).toBe('');
                expect(card.headMasterRemarks ?? '', `${NAMES[pupil]}: head teacher remarks`).toBe('');
            }
        });

        test('the Report dialog still shows the remarks but can no longer be saved', async ({ page }) => {
            const sheet = new MasterSheetPage(page);
            await sheet.open(room.className);
            const report = await sheet.openReport(room.pupils[0].student.lastName);

            expect(await report.teacherRemarks()).toContain(remarks.teacher);
            expect(await report.headTeacherRemarks()).toContain(remarks.headRevised);
            await expect(report.saveButton).toBeDisabled();
            await report.cancel();
        });

        test('scores and report cards of a published class can no longer be changed', async ({ page }) => {
            const grades = new GradeRecordPage(page);
            await grades.visit(room.courses[0].classCourseId);
            const response = await grades.record(room.pupils[0].student.lastName, { ca: 1, caMax: CA_MAX, exam: 1, examMax: EXAM_MAX });
            expect(response.status(), 'a score change is refused').toBe(400);
            expect(await response.text()).toMatch(/published/i);
            await grades.cancelDialog();

            const edit = await admin.send('PATCH', `${admin.academics}/grade-records/report/${reportId}`,
                { termId, enrollmentId: enrollmentIds[0], teacherRemarks: 'changed after publishing', headMasterRemarks: remarks.headRevised, status: 'DRAFT' });
            expect(edit.status, 'a report card change is refused').toBe(400);

            checkApiSheet(await sheetFromApi());
            expect((await reportFromApi(0)).teacherRemarks).not.toContain('changed after publishing');
        });
    });

    test.describe('what parents and teachers can do with published results', () => {
        let parent: ApiSession;

        test('a parent reads their own child\'s published report card', async ({ browser }) => {
            parent = await openApiSession(browser, room.pupils[0].guardian.phoneNumber, PASSWORD);

            const card = await parent.get(`${parent.academics}/grade-records/report?enrollmentId=${enrollmentIds[0]}&termId=${termId}`);
            expect(card.status, card.body.slice(0, 200)).toBe(200);
            const data = JSON.parse(card.body).data;
            expect(data.status).toBe('PUBLISHED');
            expect(data.teacherRemarks).toContain(remarks.teacher);
            expect(data.headMasterRemarks).toContain(remarks.headRevised);

            const list = await parent.get(`${parent.academics}/grade-records/reports/${room.pupils[0].studentId}`);
            expect(list.status, list.body.slice(0, 200)).toBe(200);
            expect(JSON.parse(list.body).data.map((r: { termId: number }) => r.termId)).toContain(termId);

            const figures = await parent.get(`${parent.academics}/grade-records/report-sheet?studentId=${room.pupils[0].studentId}&classId=${room.classId}&termId=${termId}`);
            expect(figures.status, figures.body.slice(0, 200)).toBe(200);
            expect(JSON.parse(figures.body).data.position).toBe(1);
        });

        test('the parent sees the published report card on their End of Term page and can open its PDF', async ({ browser }) => {
            test.setTimeout(180_000);
            const { session, portal } = await parentOnEndOfTerm(browser);
            await expect(portal.chosenChild).toContainText(room.pupils[0].student.lastName);
            expect(await portal.children(), 'the picker offers only their own children').toHaveLength(1);

            const cards = await portal.reports();
            expect(cards, 'one published term, one card').toHaveLength(1);
            expect(cards[0].term).toBe(termName);

            // clicking the card sends the parent's browser to the report's PDF; fetch that address to see what it holds
            const link = await portal.openReport(0);
            expect(link, 'a link to the stored PDF').toMatch(/^https?:\/\/.+\.pdf\?/);
            const pdf = await session.page.request.get(link);
            expect(pdf.status(), link).toBe(200);
            expect(pdf.headers()['content-type']).toContain('pdf');
            const bytes = await pdf.body();
            expect(bytes.subarray(0, 5).toString(), 'the file is a PDF').toBe('%PDF-');
            expect(bytes.byteLength, 'the PDF has content').toBeGreaterThan(1000);
            await session.close();
        });

        test('a parent cannot read another family\'s published report card', async () => {
            for (const url of [
                `${parent.academics}/grade-records/report?enrollmentId=${enrollmentIds[1]}&termId=${termId}`,
                `${parent.academics}/grade-records/report-sheet?studentId=${room.pupils[1].studentId}&classId=${room.classId}&termId=${termId}`,
                `${parent.academics}/grade-records/reports/${room.pupils[1].studentId}`,
            ]) {
                const r = await parent.get(url);
                expect([401, 403, 404], `${url.split('/grade-records/')[1]}: ${r.status} ${r.body.slice(0, 120)}`).toContain(r.status);
                expect(r.body).not.toContain(room.pupils[1].student.lastName);
            }
        });

        test('a parent can fetch their child\'s report card PDF', async () => {
            const r = await parent.get(`${parent.academics}/grade-records/report/pdf?studentId=${room.pupils[0].studentId}&classId=${room.classId}&termId=${termId}`);
            expect(r.status, r.body.slice(0, 200)).toBe(200);
            expect(JSON.parse(r.body).data, 'a link to the PDF').toMatch(/^https?:\/\//);
        });

        test('only an administrator or a head teacher can publish: a parent and a class teacher cannot', async ({ browser }) => {
            const teacher = await openApiSession(browser, room.teacher.email, PASSWORD);
            for (const who of [parent, teacher]) {
                const r = await who.send('POST', `${who.academics}/report-publications`, { classIds: [room.classId], termId, templateId: null });
                expect([401, 403], `${r.status} ${r.body.slice(0, 120)}`).toContain(r.status);
            }
            await teacher.close();
        });
    });

    test.describe('taking the results back', () => {
        test('unpublishing returns the class to draft and parents lose access', async ({ page }) => {
            const detail = new TermDetailPage(page);
            await detail.visit(termId);
            const response = await detail.unpublish(room.className);
            expect(response.status(), await response.text()).toBe(200);
            await detail.expectToastMessage(/unpublished successfully/i);
            // the table reloads after the call returns
            await expect.poll(async () => (await detail.publication(room.className)).status).toContain('DRAFT');

            const parent = await openApiSession(page.context().browser()!, room.pupils[0].guardian.phoneNumber, PASSWORD);
            const card = await parent.get(`${parent.academics}/grade-records/report?enrollmentId=${enrollmentIds[0]}&termId=${termId}`);
            expect([401, 403, 404], `${card.status} ${card.body.slice(0, 120)}`).toContain(card.status);
            expect(card.body).not.toContain(remarks.teacher);
            await parent.close();

            const { session, portal } = await parentOnEndOfTerm(page.context().browser()!);
            expect(await portal.reports(), 'the report card is gone from the parent\'s page').toEqual([]);
            await session.close();
        });

        test('publishing the class again from its row gives the card back', async ({ page, browser }) => {
            const detail = new TermDetailPage(page);
            await detail.visit(termId);
            const response = await detail.publishRow(room.className);
            expect(response.status(), await response.text()).toBe(200);
            await detail.expectToastMessage(/published successfully/i);
            await expect.poll(async () => (await detail.publication(room.className)).status).toContain('PUBLISHED');

            const parent = await openApiSession(browser, room.pupils[0].guardian.phoneNumber, PASSWORD);
            const card = await parent.get(`${parent.academics}/grade-records/report?enrollmentId=${enrollmentIds[0]}&termId=${termId}`);
            expect(card.status, card.body.slice(0, 200)).toBe(200);
            expect(JSON.parse(card.body).data.teacherRemarks).toContain(remarks.teacher);
            await parent.close();

            const { session, portal } = await parentOnEndOfTerm(browser);
            // the page shows its empty notice until the cards arrive
            await expect.poll(async () => (await portal.reports()).length, 'and it is back on the parent\'s page').toBe(1);
            expect((await portal.reports())[0].term).toBe(termName);
            await session.close();
        });
    });
});

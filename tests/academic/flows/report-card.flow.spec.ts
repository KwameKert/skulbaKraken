import { authenticatedTest as test, expect } from '../../fixtures';
import { getLoginCredentials } from '../../data/credentials';
import { ApiSession, openApiSession } from '../../helpers/api';
import { buildClassroom, Classroom } from '../../helpers/classroom';
import { GradeRecordPage } from '../../pages/GradeRecordPage';
import { MasterSheetPage } from '../../pages/MasterSheetPage';

/**
 * From scores to the master sheet. A class with three courses and four students is scored through the
 * course pages, then the master sheet is checked twice: the API response, and what the screen shows.
 * Both are compared with figures this file works out for itself from the scores it entered:
 *   course total = weighted CA + weighted exam   (CA out of 20 at 40%, exam out of 80 at 60%)
 *   row total    = the sum of the course totals
 *   position     = by row total, highest first; equal totals share a position and the next one skips ahead
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

let room: Classroom;
let termId = 0;
let admin: ApiSession;

/** The sheet as the API returns it, in the order it returns it. */
async function sheetFromApi() {
    const response = await admin.get(`${admin.academics}/grade-records/master-sheet?classId=${room.classId}&termId=${termId}`);
    expect(response.status, response.body.slice(0, 200)).toBe(200);
    return JSON.parse(response.body).data as { studentName: string; subjectGrades: Record<string, number>; totalScore: number; position: number }[];
}

function checkApiSheet(sheet: Awaited<ReturnType<typeof sheetFromApi>>) {
    const expected = expectedSheet();
    expect(sheet, 'one row per enrolled student').toHaveLength(NAMES.length);
    expected.forEach((want, i) => {
        const got = sheet[i];
        const who = `${NAMES[want.pupil]} (row ${i + 1})`;
        expect(got.studentName, `${who}: row order`).toContain(room.pupils[want.pupil].student.lastName);
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
    expected.forEach((want, i) => {
        const got = rows[i];
        const who = `${NAMES[want.pupil]} (row ${i + 1})`;
        expect(got.student, `${who}: row order`).toContain(room.pupils[want.pupil].student.lastName);
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
        termId = (await response.json()).data.termId;
    }
}

test.describe.serial('Report card flow: scores to master sheet', { tag: '@flow' }, () => {
    test('builds a class with three courses and four enrolled students', async ({ page }) => {
        test.setTimeout(480_000);
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
});

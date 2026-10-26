import { authenticatedTest as test, expect } from '../fixtures';
import { createClass } from '../helpers/classes';
import { createChild, enrol } from '../helpers/students';
import { ClassDetailsPage } from '../pages/ClassDetailsPage';
import { CoursePage } from '../pages/CoursePage';
import { GradeBand, GradeScalePage, letterFor, STANDARD_SCALE } from '../pages/GradeScalePage';
import { GradeRecordPage } from '../pages/GradeRecordPage';
import { StaffPage } from '../pages/StaffPage';
import { makeGuardian, makeStaff, makeStudent } from '../data/people';

/**
 * Recording a student's scores for a course. The server turns two raw scores into the figures that
 * end up on report cards, so this is where a mistake does the most damage:
 *   weighted CA   = CA score   / CA maximum   x CA weight     (rounded to the class's precision)
 *   weighted exam = exam score / exam maximum x exam weight    (rounded to the class's precision)
 *   total         = weighted CA + weighted exam
 *   grade         = the letter whose range contains the total
 * The class has its own weights (40/60, one decimal), so nothing depends on the school-wide settings.
 */
const tag = Date.now().toString(36);
const className = `Gradebook Class ${tag}`;
const courseName = `Gradebook Course ${tag}`;
const teacher = makeStaff({ employeeType: 'Teacher' });
const pupils = [makeStudent(), makeStudent(), makeStudent()];
const [first, second, third] = pupils;

let scale: GradeBand[] = [];
const ids = { class: 0, classCourse: 0 };

test.describe.serial('Recording scores', () => {
    test('sets up a class with weights 40/60, a course, three enrolled students and a grade scale', async ({ page }) => {
        test.setTimeout(240_000);
        scale = await new GradeScalePage(page).ensureScale(STANDARD_SCALE);

        const staffPage = new StaffPage(page);
        await staffPage.visitAddForm();
        await staffPage.fillStaffForm(teacher);
        await Promise.all([
            page.waitForResponse(r => r.url().includes('/employees') && r.request().method() === 'POST'),
            staffPage.submitForm(),
        ]);
        const course = await new CoursePage(page).createCourse({ name: courseName, courseId: `GB${tag}`, teacherName: `${teacher.firstName} ${teacher.lastName}` });
        expect(course.ok(), `status ${course.status()}`).toBeTruthy();

        ids.class = await createClass(page, className);
        const details = new ClassDetailsPage(page);
        await details.visit(ids.class);
        const weights = await details.setGradeWeights({ ca: 40, exam: 60, precision: 1 });
        expect(weights.ok(), `weights: status ${weights.status()}: ${await weights.text()}`).toBeTruthy();

        await details.visit(ids.class);
        await details.openCoursesTab();
        const assigned = await details.assignCourse({ courseName, periods: 4 });
        expect(assigned.ok(), `status ${assigned.status()}`).toBeTruthy();
        ids.classCourse = (await assigned.json()).data.id;

        for (const pupil of pupils) {
            const studentId = await createChild(page, pupil, makeGuardian({ isPrimary: true }));
            await enrol(page, studentId, className);
        }
    });

    test('a new enrolment starts with zero scores, no grade and no position', async ({ page }) => {
        const grades = new GradeRecordPage(page);
        await grades.visit(ids.classCourse);

        for (const pupil of pupils) {
            const figures = await grades.figuresFor(pupil.lastName);
            expect(Number(figures.ca), 'weighted CA').toBe(0);
            expect(Number(figures.exam), 'weighted exam').toBe(0);
            expect(Number(figures.total), 'total').toBe(0);
        }
    });

    test('CA 15/20 and exam 50/80 with weights 40/60 give 30 + 37.5 = 67.5', async ({ page }) => {
        const grades = new GradeRecordPage(page);
        await grades.visit(ids.classCourse);

        const response = await grades.record(first.lastName, { ca: 15, caMax: 20, exam: 50, examMax: 80 });

        expect(response.ok(), `status ${response.status()}: ${await response.text()}`).toBeTruthy();
        const figures = await grades.figuresWithTotal(first.lastName, 67.5);
        expect(Number(figures.ca)).toBe(30);
        expect(Number(figures.exam)).toBe(37.5);
        expect(Number(figures.total)).toBe(67.5);
    });

    test('the grade letter is the one whose range contains the total', async ({ page }) => {
        const grades = new GradeRecordPage(page);
        await grades.visit(ids.classCourse);

        const figures = await grades.figuresFor(first.lastName);

        expect(figures.grade).toBe(letterFor(scale, 67.5));
        expect(figures.grade, 'a total of 67.5 must earn a letter').not.toBe('');
    });

    test('each part is rounded to the class precision before the total is added', async ({ page }) => {
        const grades = new GradeRecordPage(page);
        await grades.visit(ids.classCourse);

        // 17/20 x 40 = 34.0   and   41/70 x 60 = 35.142857... -> 35.1   so the total is 69.1
        const response = await grades.record(second.lastName, { ca: 17, caMax: 20, exam: 41, examMax: 70 });

        expect(response.ok(), `status ${response.status()}`).toBeTruthy();
        const figures = await grades.figuresWithTotal(second.lastName, 69.1);
        expect(Number(figures.ca)).toBe(34);
        expect(Number(figures.exam)).toBe(35.1);
        expect(Number(figures.total)).toBe(69.1);
    });

    test('a third student is scored lower', async ({ page }) => {
        const grades = new GradeRecordPage(page);
        await grades.visit(ids.classCourse);

        // 10/20 x 40 = 20 and 40/80 x 60 = 30 -> 50
        const response = await grades.record(third.lastName, { ca: 10, caMax: 20, exam: 40, examMax: 80 });

        expect(response.ok(), `status ${response.status()}`).toBeTruthy();
        const figures = await grades.figuresWithTotal(third.lastName, 50);
        expect(figures.grade).toBe(letterFor(scale, 50));
    });

    test('positions stay empty until results are published', async ({ page }) => {
        // Position is worked out when a class's results are published (it needs the whole class's totals),
        // so entering scores never shows one.
        const grades = new GradeRecordPage(page);
        await grades.visit(ids.classCourse);

        for (const pupil of pupils) {
            expect((await grades.figuresFor(pupil.lastName)).position).toBe('');
        }
    });

    test('editing a score recomputes the figures and the grade', async ({ page }) => {
        const grades = new GradeRecordPage(page);
        await grades.visit(ids.classCourse);

        // the second student's exam drops: 20/70 x 60 = 17.1 -> total 51.1
        const response = await grades.record(second.lastName, { ca: 17, caMax: 20, exam: 20, examMax: 70 });

        expect(response.ok(), `status ${response.status()}`).toBeTruthy();
        await grades.visit(ids.classCourse);
        const figures = await grades.figuresWithTotal(second.lastName, 51.1);
        expect(Number(figures.exam)).toBe(17.1);
        expect(Number(figures.total)).toBe(51.1);
        expect(figures.grade).toBe(letterFor(scale, 51.1));
        // the other students are untouched
        expect(Number((await grades.figuresFor(first.lastName)).total)).toBe(67.5);
        expect(Number((await grades.figuresFor(third.lastName)).total)).toBe(50);
    });

    test('remarks are saved and shown when the record is opened again', async ({ page }) => {
        const grades = new GradeRecordPage(page);
        await grades.visit(ids.classCourse);

        const response = await grades.record(first.lastName, { ca: 15, caMax: 20, exam: 50, examMax: 80, remarks: 'Steady progress' });
        expect(response.ok(), `status ${response.status()}`).toBeTruthy();

        await grades.visit(ids.classCourse);
        await grades.openRecord(first.lastName);
        await expect(page.locator('mat-dialog-container textarea[formcontrolname="remarks"]')).toHaveValue('Steady progress');
        await expect(page.locator('mat-dialog-container [formcontrolname="examScore"]')).toHaveValue('50');
        await expect(page.locator('mat-dialog-container [formcontrolname="totalExamScore"]')).toHaveValue('80');
        await grades.cancelDialog();
    });

    test.describe('awkward input', () => {
        const refusedAndUnchanged = async (page: import('@playwright/test').Page, entry: Parameters<GradeRecordPage['record']>[1]) => {
            const grades = new GradeRecordPage(page);
            await grades.visit(ids.classCourse);
            const before = await grades.figuresFor(third.lastName);

            await grades.openRecord(third.lastName);
            await grades.fill(entry);
            const response = await grades.submit();

            const status = response.status();
            expect(status, await response.text()).toBeGreaterThanOrEqual(400);
            expect(status).toBeLessThan(500);
            await grades.visit(ids.classCourse);
            expect(await grades.figuresFor(third.lastName), 'a refused score must not change the record').toEqual(before);
        };

        test('a score above its own maximum is refused', async ({ page }) => {
            await refusedAndUnchanged(page, { ca: 25, caMax: 20, exam: 40, examMax: 80 });
        });

        test('an exam score above its maximum is refused', async ({ page }) => {
            await refusedAndUnchanged(page, { ca: 10, caMax: 20, exam: 90, examMax: 80 });
        });

        test('a maximum of zero is refused instead of dividing by zero', async ({ page }) => {
            await refusedAndUnchanged(page, { ca: 0, caMax: 0, exam: 40, examMax: 80 });
        });

        test('a negative score cannot be saved', async ({ page }) => {
            const grades = new GradeRecordPage(page);
            await grades.visit(ids.classCourse);

            await grades.openRecord(third.lastName);
            await grades.fill({ ca: -5, caMax: 20, exam: 40, examMax: 80 });

            await expect(grades.submitButton).toBeDisabled();
            await grades.cancelDialog();
        });
    });

    test('a total that falls between two grade bands still earns a letter', async ({ page }) => {
        // 16.5/20 x 40 = 33 and 62/80 x 60 = 46.5 give 79.5. The standard bands are whole numbers
        // (B 70-79, A 80-100), so 79.5 sits in the gap between them.
        const grades = new GradeRecordPage(page);
        await grades.visit(ids.classCourse);

        const response = await grades.record(third.lastName, { ca: 16.5, caMax: 20, exam: 62, examMax: 80 });

        expect(response.ok(), `status ${response.status()}`).toBeTruthy();
        const figures = await grades.figuresWithTotal(third.lastName, 79.5);
        expect(Number(figures.total)).toBe(79.5);
        expect(figures.grade, 'grade for a total of 79.5').not.toBe('');
    });
});

import { authenticatedTest as test, expect } from '../fixtures';
import { getLoginCredentials } from '../data/credentials';
import { makeStaff } from '../data/people';
import { createClass } from '../helpers/classes';
import { openApiSession } from '../helpers/api';
import { signInAndSetPassword } from '../helpers/session';
import { saveTimetableFixture, TimetableFixture } from '../helpers/timetable-fixture';
import { ClassDetailsPage } from '../pages/ClassDetailsPage';
import { CoursePage } from '../pages/CoursePage';
import { StaffPage } from '../pages/StaffPage';
import { TimetablePage } from '../pages/TimetablePage';

const PASSWORD = 'Timetable#2026';
const PERIODS = 3;

/**
 * One class with a finished timetable, for the flows that need lessons. The solver is capped at two
 * minutes and never stops early, so this is built once here instead of in every flow.
 */
test.describe('Timetable for flows', () => {
    test('builds a class with a teacher, two courses and a generated timetable', async ({ page, browser }) => {
        test.setTimeout(420_000);
        const teacher = makeStaff({ employeeType: 'Teacher' });
        const teacherName = `${teacher.firstName} ${teacher.lastName}`;
        const className = 'Lesson Plan Class';
        const courseNames = ['Plan Maths', 'Plan English'];

        const staffPage = new StaffPage(page);
        await staffPage.visitAddForm();
        await staffPage.fillStaffForm(teacher);
        await Promise.all([
            page.waitForResponse(r => r.url().includes('/employees') && r.request().method() === 'POST'),
            staffPage.submitForm(),
        ]);

        const coursePage = new CoursePage(page);
        for (const [index, name] of courseNames.entries()) {
            const created = await coursePage.createCourse({ name, courseId: `LP${index}`, teacherName });
            expect(created.ok(), `create ${name}: status ${created.status()}`).toBeTruthy();
        }

        const classId = await createClass(page, className, 'ACTIVE', teacherName, 'E2E Default Timetable');
        const details = new ClassDetailsPage(page);
        const courses: TimetableFixture['courses'] = [];
        for (const name of courseNames) {
            await details.visit(classId);
            await details.openCoursesTab();
            const assigned = await details.assignCourse({ courseName: name, periods: PERIODS });
            expect(assigned.ok(), `assign ${name}: status ${assigned.status()}`).toBeTruthy();
            courses.push({ name, classCourseId: (await assigned.json()).data.id, periods: PERIODS });
        }

        const timetable = new TimetablePage(page);
        await timetable.visit();
        const queued = await timetable.generate([className]);
        expect(queued.ok(), `queue: status ${queued.status()} ${await queued.text()}`).toBeTruthy();
        const jobId = (await queued.json()).data.id;
        const termId = (await queued.json()).data.termId;

        const { email, password } = getLoginCredentials();
        const admin = await openApiSession(browser, email, password);
        await expect.poll(async () => {
            const jobs = JSON.parse((await admin.get(`${admin.academics}/time-table/jobs`)).body).data as { id: number; status: string; error: string }[];
            const job = jobs.find(j => j.id === jobId)!;
            expect(job.error, 'the solver failed').toBeNull();
            return job.status;
        }, { message: 'timetable job finishes', timeout: 300_000, intervals: [5_000] }).toBe('SUCCEEDED');

        const term = JSON.parse((await admin.get(`${admin.academics}/terms/${termId}`)).body).data;
        await admin.close();

        // the teacher chooses their own password now, so flows can sign in with it later
        const session = await signInAndSetPassword(browser, teacher.email, PASSWORD);
        await session.close();

        saveTimetableFixture({
            className, classId, termId, termName: term.name, teacher, teacherPassword: PASSWORD, courses,
            lessonCount: courseNames.length * PERIODS,
        });
    });
});

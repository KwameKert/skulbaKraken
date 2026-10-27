import { authenticatedTest as test, expect } from '../../fixtures';
import { getLoginCredentials } from '../../data/credentials';
import { makeStaff } from '../../data/people';
import { ApiSession, openApiSession } from '../../helpers/api';
import { signIn, signInAndSetPassword } from '../../helpers/session';
import { loadTimetableFixture, TimetableFixture } from '../../helpers/timetable-fixture';
import { LessonPlanDetailsPage } from '../../pages/LessonPlanDetailsPage';
import { LessonPlannerPage } from '../../pages/LessonPlannerPage';
import { StaffPage } from '../../pages/StaffPage';

/**
 * A teacher plans a lesson from the timetable, the head teacher reviews it, and the teacher sees the review.
 *
 * The lessons come from the timetable built once in setup (tests/setup/07-timetable.spec.ts): the class
 * "Lesson Plan Class" with Plan Maths and Plan English, three lessons each. Everything here is done as the
 * people who would do it: the teacher through the planner, the head teacher on the plan's page.
 *
 *   draft -> (teacher edits, submits) -> SUBMITTED -> (head teacher comments) -> REVIEW -> (approves) -> APPROVED
 *
 * Plans are matched by a topic carrying this run's tag, so earlier runs' plans never get in the way.
 */
const tag = Date.now().toString(36);
const PASSWORD = 'Headteacher#2026';
const headTeacher = makeStaff({ employeeType: 'Head Teacher' });

const plan = {
    title: `Fractions ${tag}`,
    topic: `Adding fractions ${tag}`,
    topicRevised: `Adding unlike fractions ${tag}`,
    description: `Start with pizza slices, then number lines ${tag}`,
    summary: `Pupils add fractions with the same denominator ${tag}`,
    comment: `Add a worked example before the exercise ${tag}`,
    second: `Subtraction of fractions ${tag}`,
};

let fixture: TimetableFixture;
let admin: ApiSession;
/** a Monday-or-later date eight days into the term, so it falls in week 2 */
let lessonDate = '';
const WEEK = 2;
/** the lesson picked for 'Plan Maths' is whichever of its three the form lists first */
let mathsLessonIds: number[] = [];
let mathsLessonId = 0;
let teacherId = 0;
let planId = 0;

function isoDaysAfter(start: string, days: number): string {
    const [y, m, d] = start.split('-').map(Number);
    return new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10);
}

async function planFromApi(id = planId) {
    const response = await admin.get(`${admin.academics}/lesson-planners/${id}`);
    expect(response.status, response.body.slice(0, 200)).toBe(200);
    return JSON.parse(response.body).data;
}

/** Signing in lands on the dashboard a moment later; go nowhere before that or it takes the page back. */
async function signedIn(browser: import('@playwright/test').Browser, username: string, password: string) {
    const session = await signIn(browser, username, password);
    await session.page.waitForURL(/\/dashboard/);
    return session;
}

async function teacherSession(browser: import('@playwright/test').Browser) {
    return signedIn(browser, fixture.teacher.email, fixture.teacherPassword);
}

test.describe.serial('Lesson plan flow: plan, review, approve @flow', () => {
    test.beforeAll(async ({ browser }) => {
        fixture = loadTimetableFixture();
        const { email, password } = getLoginCredentials();
        admin = await openApiSession(browser, email, password);
        const term = JSON.parse((await admin.get(`${admin.academics}/terms/${fixture.termId}`)).body).data;
        lessonDate = isoDaysAfter(term.startDate, 8);
    });

    test.afterAll(async () => {
        await admin?.close();
    });

    test('the timetable from setup has the lessons a teacher can plan', async () => {
        const response = await admin.get(`${admin.academics}/time-table/lesson/search?termId=${fixture.termId}&classId=${fixture.classId}`);
        expect(response.status, response.body.slice(0, 200)).toBe(200);
        const lessons = JSON.parse(response.body).data as { id: number; classCourse: { course: { name: string } } }[];
        expect(lessons, 'three periods for each of the two courses').toHaveLength(fixture.lessonCount);
        mathsLessonIds = lessons.filter(l => l.classCourse.course.name === 'Plan Maths').map(l => l.id);
        expect(mathsLessonIds, 'three Maths lessons').toHaveLength(3);
        expect(lessons.filter(l => l.classCourse.course.name === 'Plan English'), 'three English lessons').toHaveLength(3);
    });

    test('a teacher writes a draft lesson plan from the planner', async ({ browser }) => {
        test.setTimeout(180_000);
        const session = await teacherSession(browser);
        const planner = new LessonPlannerPage(session.page);
        await planner.visit();
        await planner.openAddForm();
        await planner.fill({
            lesson: 'Plan Maths', title: plan.title, topic: plan.topic, lessonDate,
            description: plan.description, summary: plan.summary, status: 'Draft',
        });
        const response = await planner.submit();
        expect(response.status(), await response.text()).toBe(201);
        const sent = response.request().postDataJSON();
        expect(mathsLessonIds, 'a Maths lesson was picked on the form').toContain(sent.lessonId);
        mathsLessonId = sent.lessonId;
        expect(sent.lessonDate).toBe(lessonDate);
        teacherId = sent.employeeId;
        expect(teacherId, 'written as the signed-in teacher').toBeGreaterThan(0);
        planId = (await response.json()).data.id;
        await planner.expectToastMessage(/created successfully/i);
        await session.close();

        const stored = await planFromApi();
        expect(stored).toMatchObject({ title: plan.title, topic: plan.topic, status: 'DRAFT', lessonDate, lessonId: mathsLessonId, employeeId: teacherId });
        expect(stored.description).toContain(plan.description);
        expect(stored.summary).toBe(plan.summary);
    });

    test('the weekly overview files it under the right week, class and course', async ({ browser }) => {
        const response = await admin.get(`${admin.academics}/lesson-planners/weekly-overview?termId=${fixture.termId}&employeeId=${teacherId}`);
        expect(response.status, response.body.slice(0, 200)).toBe(200);
        const weeks = JSON.parse(response.body).data.weeks as {
            weekNumber: number;
            classCourses: { schoolClassName: string; courseName: string; lessonPlans: { id: number; topic: string; status: string }[] }[];
        }[];
        const week = weeks.find(w => w.weekNumber === WEEK)!;
        expect(week, `week ${WEEK} has the plan`).toBeTruthy();
        const group = week.classCourses.find(g => g.courseName === 'Plan Maths' && g.schoolClassName === fixture.className)!;
        expect(group.lessonPlans.find(p => p.id === planId)).toMatchObject({ topic: plan.topic, status: 'DRAFT' });

        const session = await teacherSession(browser);
        const planner = new LessonPlannerPage(session.page);
        await planner.visit();
        await planner.drillTo(WEEK, fixture.className, 'Plan Maths');
        await expect(planner.planRow(plan.topic)).toContainText('DRAFT');
        await session.close();
    });

    test('a teacher can only choose Draft or Submitted for the status', async ({ browser }) => {
        const session = await teacherSession(browser);
        const planner = new LessonPlannerPage(session.page);
        await planner.visit();
        await planner.openAddForm();
        expect(await planner.statusOptions()).toEqual(['Draft', 'Submitted']);
        await session.close();
    });

    test('the teacher edits the plan and submits it', async ({ browser }) => {
        test.setTimeout(180_000);
        const session = await teacherSession(browser);
        const planner = new LessonPlannerPage(session.page);
        await planner.visit();
        await planner.drillTo(WEEK, fixture.className, 'Plan Maths');
        await planner.editPlan(plan.topic);
        await expect(session.page.getByRole('heading', { name: 'Edit Lesson Plan' })).toBeVisible();
        await expect(session.page.locator('#title')).toHaveValue(plan.title);
        await planner.fill({ topic: plan.topicRevised, reflection: 'Went well', status: 'Submitted' });
        const response = await planner.submit();
        expect(response.status(), await response.text()).toBe(200);
        await session.close();

        const stored = await planFromApi();
        expect(stored).toMatchObject({ topic: plan.topicRevised, status: 'SUBMITTED', reflection: 'Went well' });
        expect(stored.title, 'untouched fields stay').toBe(plan.title);
        expect(stored.description, 'including the description').toContain(plan.description);
    });

    test('a head teacher is added to review plans', async ({ page }) => {
        test.setTimeout(180_000);
        const staffPage = new StaffPage(page);
        await staffPage.visitAddForm();
        await staffPage.fillStaffForm(headTeacher);
        await Promise.all([
            page.waitForResponse(r => r.url().includes('/employees') && r.request().method() === 'POST'),
            staffPage.submitForm(),
        ]);
    });

    test('the head teacher reads the plan and comments, which puts it in review', async ({ browser }) => {
        test.setTimeout(180_000);
        const session = await signInAndSetPassword(browser, headTeacher.email, PASSWORD);
        const details = new LessonPlanDetailsPage(session.page);
        await details.visit(planId);
        await details.expectLoaded(plan.title);
        await expect(details.status).toContainText('SUBMITTED');
        await expect(details.description).toContainText(plan.description);

        const response = await details.comment(plan.comment);
        expect(response.status(), await response.text()).toBe(200);
        await expect(details.status).toContainText('REVIEW');
        await expect(details.section('Head Teacher Comment')).toContainText(plan.comment);
        await expect(details.section('Head Teacher Comment')).toContainText(`${headTeacher.firstName} ${headTeacher.lastName}`);
        await session.close();

        const stored = await planFromApi();
        expect(stored).toMatchObject({ status: 'REVIEW', headTeacherComment: plan.comment, reviewedByFirstName: headTeacher.firstName });
        expect(stored.reviewedAt).toBeTruthy();
    });

    test('the head teacher approves it', async ({ browser }) => {
        const session = await signedIn(browser, headTeacher.email, PASSWORD);
        const details = new LessonPlanDetailsPage(session.page);
        await details.visit(planId);
        await expect(details.reviewButton, 'already in review').toHaveCount(0);
        const response = await details.approve();
        expect(response.status(), await response.text()).toBe(200);
        await expect(details.status).toContainText('APPROVED');
        await expect(details.approveButton, 'nothing left to approve').toHaveCount(0);
        await session.close();

        const stored = await planFromApi();
        expect(stored.status).toBe('APPROVED');
        expect(stored.headTeacherComment, 'approving keeps the comment').toBe(plan.comment);
    });

    test('the teacher sees the review but has no review controls', async ({ browser }) => {
        const session = await teacherSession(browser);
        const details = new LessonPlanDetailsPage(session.page);
        await details.visit(planId);
        await details.expectLoaded(plan.title);
        await expect(details.status).toContainText('APPROVED');
        await expect(details.section('Head Teacher Comment')).toContainText(plan.comment);
        await expect(details.section('Head Teacher Comment')).toContainText(`${headTeacher.firstName} ${headTeacher.lastName}`);
        await expect(details.commentBox).toHaveCount(0);
        await expect(details.approveButton).toHaveCount(0);
        await session.close();
    });

    test('a teacher deletes a second plan and it disappears everywhere', async ({ browser }) => {
        test.setTimeout(180_000);
        const session = await teacherSession(browser);
        const planner = new LessonPlannerPage(session.page);
        await planner.visit();
        await planner.openAddForm();
        await planner.fill({ lesson: 'Plan English', title: plan.second, topic: plan.second, lessonDate, status: 'Draft' });
        const created = await planner.submit();
        expect(created.status(), await created.text()).toBe(201);
        const secondId = (await created.json()).data.id;

        await planner.visit();
        await planner.drillTo(WEEK, fixture.className, 'Plan English');
        await expect(planner.planRow(plan.second)).toBeVisible();
        const deleted = await planner.deletePlan(plan.second);
        expect(deleted.status(), await deleted.text()).toBe(200);
        await planner.expectToastMessage(/deleted successfully/i);
        await expect(planner.planRow(plan.second)).toHaveCount(0);
        await session.close();

        const byId = await admin.get(`${admin.academics}/lesson-planners/${secondId}`);
        expect(byId.status, 'a deleted plan cannot be fetched').toBe(404);
        const overview = await admin.get(`${admin.academics}/lesson-planners/weekly-overview?termId=${fixture.termId}&employeeId=${teacherId}`);
        expect(overview.body).not.toContain(plan.second);
        const list = await admin.get(`${admin.academics}/lesson-planners?employeeId=${teacherId}&size=100`);
        expect(list.body).not.toContain(plan.second);
        expect(list.body, 'while the approved one is still listed').toContain(plan.topicRevised);
    });
});

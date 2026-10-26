import { Page } from '@playwright/test';
import { expect } from '../fixtures';
import { makeGuardian, makeStaff, makeStudent } from '../data/people';
import { ClassDetailsPage } from '../pages/ClassDetailsPage';
import { CoursePage } from '../pages/CoursePage';
import { StaffPage } from '../pages/StaffPage';
import { createClass } from './classes';
import { createChild, enrol } from './students';

export interface ClassroomOptions {
    /** makes every name unique to this run */
    tag: string;
    /** one course is created and assigned to the class per name */
    courseNames: string[];
    students: number;
    /** the class's own weights, so nothing depends on the school-wide settings */
    weights?: { ca: number; exam: number; precision: number };
}

export interface Classroom {
    className: string;
    classId: number;
    teacher: ReturnType<typeof makeStaff>;
    courses: { name: string; classCourseId: number }[];
    pupils: { student: ReturnType<typeof makeStudent>; guardian: ReturnType<typeof makeGuardian>; studentId: number }[];
}

/**
 * Builds a class the way an administrator would: a teacher, the courses, the class (with that teacher as
 * its class teacher) and its weights, the courses assigned to it and enrolled students, each with a guardian. Every flow that needs a
 * populated class starts here.
 */
export async function buildClassroom(page: Page, options: ClassroomOptions): Promise<Classroom> {
    const { tag, courseNames, students, weights = { ca: 40, exam: 60, precision: 1 } } = options;
    const className = `Flow Class ${tag}`;
    const teacher = makeStaff({ employeeType: 'Teacher' });
    const teacherName = `${teacher.firstName} ${teacher.lastName}`;

    const staffPage = new StaffPage(page);
    await staffPage.visitAddForm();
    await staffPage.fillStaffForm(teacher);
    await Promise.all([
        page.waitForResponse(r => r.url().includes('/employees') && r.request().method() === 'POST'),
        staffPage.submitForm(),
    ]);

    const coursePage = new CoursePage(page);
    for (const [index, name] of courseNames.entries()) {
        const created = await coursePage.createCourse({ name, courseId: `FL${index}${tag}`, teacherName });
        expect(created.ok(), `create course ${name}: status ${created.status()}`).toBeTruthy();
    }

    const classId = await createClass(page, className, 'ACTIVE', teacherName);
    const details = new ClassDetailsPage(page);
    await details.visit(classId);
    const set = await details.setGradeWeights(weights);
    expect(set.ok(), `weights: status ${set.status()}: ${await set.text()}`).toBeTruthy();

    const courses: Classroom['courses'] = [];
    for (const name of courseNames) {
        await details.visit(classId);
        await details.openCoursesTab();
        const assigned = await details.assignCourse({ courseName: name, periods: 4 });
        expect(assigned.ok(), `assign ${name}: status ${assigned.status()}`).toBeTruthy();
        courses.push({ name, classCourseId: (await assigned.json()).data.id });
    }

    const pupils: Classroom['pupils'] = [];
    for (let i = 0; i < students; i++) {
        const student = makeStudent();
        const guardian = makeGuardian({ isPrimary: true });
        const studentId = await createChild(page, student, guardian);
        await enrol(page, studentId, className);
        pupils.push({ student, guardian, studentId });
    }

    return { className, classId, teacher, courses, pupils };
}

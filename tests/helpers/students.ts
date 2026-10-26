import { Page } from '@playwright/test';
import { expect } from '../fixtures';
import { EnrollmentPage } from '../pages/EnrollmentPage';
import { StudentsPage } from '../pages/StudentsPage';
import { makeGuardian, makeStudent } from '../data/people';

/** Creates a student (with one guardian) through the portal and returns the new student's id. */
export async function createChild(
    page: Page,
    child: ReturnType<typeof makeStudent>,
    guardian: ReturnType<typeof makeGuardian>,
): Promise<number> {
    const studentsPage = new StudentsPage(page);
    await studentsPage.visitAddForm();
    await studentsPage.fillStudentForm(child);
    await studentsPage.addGuardian(guardian);
    const [response] = await Promise.all([
        page.waitForResponse(res => res.url().includes('/students') && !res.url().includes('/guardians') && res.request().method() === 'POST'),
        studentsPage.submitForm(),
    ]);
    expect(response.ok(), `create ${child.lastName}: status ${response.status()}`).toBeTruthy();
    await expect(page).toHaveURL(/student-details\/(\d+)/i);
    return Number(page.url().match(/student-details\/(\d+)/)![1]);
}

/** Enrols a student in a class from their Enrollments tab and returns the academic year id used. */
export async function enrol(page: Page, studentId: number, className: string): Promise<number> {
    const enrollment = new EnrollmentPage(page);
    await enrollment.visit(studentId);
    const response = await enrollment.enrollInto(className);
    expect(response.ok(), `enrol into ${className}: status ${response.status()}`).toBeTruthy();
    return response.request().postDataJSON().academicYearId;
}

import { expect, Locator, Page, Response } from '@playwright/test';
import { BasePage } from './BasePage';

export interface CourseAssignmentData {
    /** course name as shown in the dropdown (the teacher's name follows it) */
    courseName: string;
    periods: number;
    status?: 'Active' | 'Inactive';
}

/** A class's details page: class teacher card and the "Course Assigned" tab. */
export class ClassDetailsPage extends BasePage {
    constructor(page: Page) {
        super(page);
    }

    async visit(classId: number | string): Promise<void> {
        await this.page.goto(`/academic/classes/${classId}`);
        await expect(this.page.getByText('Class Information')).toBeVisible();
        await this.page.waitForLoadState('networkidle');
    }

    // ── class teacher ───────────────────────────────────────────────────────
    private get teacherCard(): Locator {
        return this.page.locator('.card').filter({ has: this.page.getByRole('heading', { name: 'Class Teacher' }) });
    }

    /** Names shown under "Class Teacher". */
    get classTeachers(): Locator {
        return this.teacherCard.locator('h5.text-truncate');
    }

    // ── courses assigned ────────────────────────────────────────────────────
    private get coursesPanel(): Locator {
        return this.page.locator('app-courses-assigned');
    }

    /**
     * Opens the tab and waits for the course list to arrive. The "No courses assigned yet" message is
     * shown before the list loads, so waiting for that text (or for an empty list) proves nothing.
     */
    async openCoursesTab(): Promise<void> {
        await Promise.all([
            this.page.waitForResponse(res => /assign-courses\/search/.test(res.url()) && res.request().method() === 'GET'),
            this.page.locator('a.nav-link').filter({ hasText: 'Course Assigned' }).click(),
        ]);
        await expect(this.coursesPanel.getByRole('heading', { name: 'Courses Assigned' })).toBeVisible();
        await this.page.waitForLoadState('networkidle');
    }

    get courseCards(): Locator {
        return this.coursesPanel.locator('.course-card');
    }

    cardFor(courseName: string): Locator {
        return this.courseCards.filter({ hasText: courseName });
    }

    async expectNoCourses(): Promise<void> {
        await expect(this.coursesPanel.getByText('No courses assigned yet.')).toBeVisible();
        await expect(this.courseCards).toHaveCount(0);
    }

    private get dialog(): Locator {
        return this.page.locator('mat-dialog-container');
    }

    get dialogSubmit(): Locator {
        return this.dialog.locator('mat-dialog-actions button.btn-primary');
    }

    async openAssignDialog(): Promise<void> {
        await this.coursesPanel.locator('a.btn').filter({ hasText: /assign course/i }).click();
        await expect(this.dialog.getByRole('heading', { name: /course assignment/i })).toBeVisible();
    }

    async fillAssignment(data: Partial<CourseAssignmentData>): Promise<void> {
        if (data.courseName) {
            await this.dialog.locator('ng-select[formcontrolname="courseId"]').click();
            await this.page.locator('.ng-option').filter({ hasText: data.courseName }).first().click();
        }
        if (data.periods !== undefined) {
            await this.dialog.locator('input[formcontrolname="numOfPeriod"]').fill(String(data.periods));
        }
        if (data.status) {
            await this.dialog.locator('select[formcontrolname="status"]').selectOption({ label: data.status });
        }
    }

    /** Assigns a course to the class (needs the tab open). Resolves with the API response. */
    async assignCourse(data: CourseAssignmentData): Promise<Response> {
        await this.openAssignDialog();
        await this.fillAssignment({ status: 'Active', ...data });
        return this.submitAssignment('POST');
    }

    async submitAssignment(method: 'POST' | 'PUT'): Promise<Response> {
        const [response] = await Promise.all([
            this.page.waitForResponse(res => /assign-courses(\/\d+)?$/.test(res.url()) && res.request().method() === method),
            this.dialogSubmit.click(),
        ]);
        await expect(this.dialog).toBeHidden();
        return response;
    }

    async cancelDialog(): Promise<void> {
        await this.dialog.locator('a[mat-dialog-close]').click();
        await expect(this.dialog).toBeHidden();
    }

    private async clickCardAction(courseName: string, action: RegExp): Promise<void> {
        const card = this.cardFor(courseName);
        await card.locator('a[data-bs-toggle="dropdown"]').click();
        await card.locator('.dropdown-item').filter({ hasText: action }).first().click();
    }

    /** The card menu's "Synchronise": refreshes the course records of the students in the class. */
    async synchronise(courseName: string): Promise<Response> {
        const [response] = await Promise.all([
            this.page.waitForResponse(res => /assign-courses\/sync\/\d+$/.test(res.url()) && res.request().method() === 'POST'),
            this.clickCardAction(courseName, /synchronise/i),
        ]);
        return response;
    }

    async openEditAssignment(courseName: string): Promise<void> {
        await this.clickCardAction(courseName, /edit/i);
        await expect(this.dialog.getByRole('heading', { name: /edit course assignment/i })).toBeVisible();
    }

    async startDelete(courseName: string): Promise<void> {
        await this.clickCardAction(courseName, /delete/i);
        await expect(this.page.locator('.swal2-popup')).toBeVisible();
    }

    async cancelDelete(): Promise<void> {
        await this.page.locator('.swal2-cancel').click();
        await expect(this.page.locator('.swal2-popup')).toBeHidden();
    }

    async confirmDelete(): Promise<Response> {
        const [response] = await Promise.all([
            this.page.waitForResponse(res => /assign-courses\/\d+$/.test(res.url()) && res.request().method() === 'DELETE'),
            this.page.locator('.swal2-confirm').click(),
        ]);
        await expect(this.page.locator('.swal2-popup')).toBeHidden();
        return response;
    }

    // ── grade weights ───────────────────────────────────────────────────────
    /** Sets this class's own weights for continuous assessment and exam, and the rounding precision. */
    async setGradeWeights(weights: { ca: number; exam: number; precision: number }): Promise<Response> {
        await this.page.locator('a.nav-link').filter({ hasText: 'Grade Weights' }).click();
        const panel = this.page.locator('app-class-weight');
        await expect(panel.getByRole('heading', { name: 'Grade Weights' })).toBeVisible();
        await this.page.waitForLoadState('networkidle');
        await panel.locator('[formcontrolname="continuousAssessmentWeight"]').fill(String(weights.ca));
        await panel.locator('[formcontrolname="examWeight"]').fill(String(weights.exam));
        await panel.locator('[formcontrolname="roundingPrecision"]').fill(String(weights.precision));
        const [response] = await Promise.all([
            this.page.waitForResponse(res => /class-weights/.test(res.url()) && ['POST', 'PUT'].includes(res.request().method())),
            panel.getByRole('button', { name: /save grade weights/i }).click(),
        ]);
        return response;
    }
}

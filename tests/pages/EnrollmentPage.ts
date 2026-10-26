import { expect, Locator, Page, Response } from '@playwright/test';
import { BasePage } from './BasePage';

/**
 * Class enrolment as the admin does it: the student's Enrollments tab (list + "Enroll Student"
 * dialog) and the class page's Student List. One student has one active enrolment at a time.
 */
export class EnrollmentPage extends BasePage {
    constructor(page: Page) {
        super(page);
    }

    private get panel(): Locator {
        return this.page.locator('app-student-detail-enrollment');
    }

    async visit(studentId: number | string): Promise<void> {
        await this.page.goto(`/peoples/students/student-details/${studentId}/academics/enrollments`);
        await expect(this.panel.getByRole('heading', { name: 'Enrollment List' })).toBeVisible();
        // either rows or the "No data available" notice means the list has finished loading
        await expect(this.panel.locator('table tr td').first()).toBeVisible();
    }

    /** Enrolment rows (the "No data available" placeholder row is not one). */
    get rows(): Locator {
        return this.panel.locator('table tr').filter({ has: this.page.locator('td') })
            .filter({ hasNotText: /no data available/i });
    }

    rowForClass(className: string): Locator {
        return this.rows.filter({ hasText: className });
    }

    async expectNoEnrollments(): Promise<void> {
        await expect(this.panel.getByText('No data available')).toBeVisible();
    }

    async expectStatus(className: string, status: 'ACTIVE' | 'INACTIVE'): Promise<void> {
        await expect(this.rowForClass(className)).toHaveCount(1);
        await expect(this.rowForClass(className)).toContainText(status);
    }

    get enrollDialog(): Locator {
        return this.page.locator('mat-dialog-container');
    }

    get dialogEnrollButton(): Locator {
        return this.enrollDialog.locator('mat-dialog-actions button.btn-primary');
    }

    async openDialog(): Promise<void> {
        await this.panel.locator('a.btn').filter({ hasText: /enroll student/i }).click();
        await expect(this.enrollDialog.getByRole('heading', { name: /class enrollment/i })).toBeVisible();
    }

    /** Class names offered in the dialog's dropdown. */
    async classOptions(): Promise<string[]> {
        await this.enrollDialog.locator('ng-select').click();
        await this.page.locator('.ng-option').first().waitFor();
        const names = (await this.page.locator('.ng-option').allTextContents()).map(n => n.trim());
        await this.page.keyboard.press('Escape');
        return names;
    }

    async chooseClass(className: string): Promise<void> {
        await this.enrollDialog.locator('ng-select').click();
        await this.page.keyboard.type(className);
        await this.page.locator('.ng-option').filter({ hasText: new RegExp(`^\\s*${className}\\s*$`) }).first().click();
    }

    /** Opens the dialog, picks the class and submits. Resolves with the enrollment API response. */
    async enrollInto(className: string): Promise<Response> {
        await this.openDialog();
        await this.chooseClass(className);
        const [response] = await Promise.all([
            this.page.waitForResponse(res => /\/enrollments$/.test(res.url()) && res.request().method() === 'POST'),
            this.dialogEnrollButton.click(),
        ]);
        await expect(this.enrollDialog).toBeHidden();
        return response;
    }

    /** "Withdraw Student" asks for confirmation first. */
    async startWithdraw(): Promise<void> {
        await this.panel.locator('a.btn').filter({ hasText: /withdraw student/i }).click();
        await expect(this.page.locator('.swal2-popup')).toBeVisible();
    }

    async cancelWithdraw(): Promise<void> {
        await this.page.locator('.swal2-cancel').click();
        await expect(this.page.locator('.swal2-popup')).toBeHidden();
    }

    /** Withdraws the student and resolves with the API response. */
    async withdraw(): Promise<Response> {
        await this.startWithdraw();
        const [response] = await Promise.all([
            this.page.waitForResponse(res => /\/withdraw$/.test(res.url()) && res.request().method() === 'POST'),
            this.page.locator('.swal2-confirm').click(),
        ]);
        await expect(this.page.locator('.swal2-popup')).toBeHidden();
        return response;
    }

    async cancelDialog(): Promise<void> {
        await this.enrollDialog.getByRole('button', { name: 'Cancel' }).click();
        await expect(this.enrollDialog).toBeHidden();
    }

    /** The class page, Student List tab. */
    async visitClassStudents(classId: number | string): Promise<void> {
        await this.page.goto(`/academic/classes/${classId}`);
        await this.page.locator('a.nav-link').filter({ hasText: 'Student List' }).click();
        await expect(this.page.locator('app-student-list table')).toBeVisible();
        await this.page.waitForLoadState('networkidle');
    }

    classStudentRow(lastName: string): Locator {
        return this.page.locator('app-student-list table tbody tr').filter({ hasText: lastName });
    }
}

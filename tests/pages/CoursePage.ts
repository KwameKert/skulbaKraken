import { expect, Page, Response } from '@playwright/test';
import { BasePage } from './BasePage';

export interface CourseFormData {
    name: string;
    /** the unique course code */
    courseId: string;
    assessmentType?: 'Score Based' | 'Skill Based';
    /** text to match in the teacher dropdown */
    teacherName: string;
}

/** The Courses page: subjects that can later be assigned to classes. Each course has its own teacher. */
export class CoursePage extends BasePage {
    constructor(page: Page) {
        super(page);
    }

    async visit(): Promise<void> {
        await this.page.goto('/academic/courses');
        await this.page.locator('table.datatable').waitFor({ state: 'visible' });
    }

    /** Creates a course through the Add Course dialog; resolves with the API response. */
    async createCourse(data: CourseFormData): Promise<Response> {
        await this.visit();
        await this.page.locator('a.btn-primary').filter({ hasText: /add course/i }).click();
        const dialog = this.page.locator('mat-dialog-container');
        await expect(dialog.getByRole('heading', { name: /add course/i })).toBeVisible();

        await dialog.locator('input[formcontrolname="name"]').fill(data.name);
        await dialog.locator('input[formcontrolname="courseId"]').fill(data.courseId);
        await dialog.locator('select[formcontrolname="assessmentType"]')
            .selectOption({ label: data.assessmentType ?? 'Score Based' });
        await dialog.locator('ng-select[formcontrolname="teacherId"]').click();
        await this.page.locator('.ng-option').filter({ hasText: data.teacherName }).first().click();

        const [response] = await Promise.all([
            this.page.waitForResponse(res => /\/courses$/.test(res.url()) && res.request().method() === 'POST'),
            dialog.locator('mat-dialog-actions button.btn-primary').click(),
        ]);
        await expect(dialog).toBeHidden();
        return response;
    }

    /** Brings a course into view with the Filter panel's name search. */
    async findCourse(name: string): Promise<void> {
        await this.searchByName(name);
        await expect(this.rowFor(name)).toBeVisible();
    }

    /** The Filter panel's server-side name search; resolves with the list API response. */
    async searchByName(name: string): Promise<Response> {
        await this.visit();
        await this.page.locator('a').filter({ has: this.page.locator('i.ti-filter') }).first().click();
        await this.page.getByPlaceholder('Search by name').fill(name);
        const [response] = await Promise.all([
            this.page.waitForResponse(res => /\/courses\?/.test(res.url()) && res.url().includes('textSearch=') && res.request().method() === 'GET' && !res.url().endsWith('textSearch=')),
            this.page.getByRole('button', { name: 'Apply' }).click(),
        ]);
        return response;
    }

    rowFor(name: string) {
        return this.page.locator('table.datatable tbody tr').filter({ hasText: name });
    }

    /** Edits a course (new name and/or new teacher); resolves with the API response. */
    async editCourse(courseName: string, changes: { name?: string; teacherName?: string }): Promise<Response> {
        await this.findCourse(courseName);
        await this.rowFor(courseName).locator('a[data-bs-toggle="dropdown"]').click();
        await this.rowFor(courseName).locator('.dropdown-item').filter({ hasText: /edit/i }).click();
        const dialog = this.page.locator('mat-dialog-container');
        await expect(dialog.getByRole('heading', { name: /edit course/i })).toBeVisible();
        if (changes.name) {
            await dialog.locator('input[formcontrolname="name"]').fill(changes.name);
        }
        if (changes.teacherName) {
            await dialog.locator('ng-select[formcontrolname="teacherId"]').click();
            await this.page.locator('.ng-option').filter({ hasText: changes.teacherName }).first().click();
        }
        const [response] = await Promise.all([
            this.page.waitForResponse(res => /\/courses\/\d+$/.test(res.url()) && ['PUT', 'PATCH'].includes(res.request().method())),
            dialog.locator('mat-dialog-actions button.btn-primary').click(),
        ]);
        await expect(dialog).toBeHidden();
        return response;
    }

    /** Edits a course and gives it a new teacher; resolves with the API response. */
    async changeTeacher(courseName: string, teacherName: string): Promise<Response> {
        return this.editCourse(courseName, { teacherName });
    }
}

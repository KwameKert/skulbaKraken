import { expect, Locator, Page, Response } from '@playwright/test';
import { BasePage } from './BasePage';

export interface ScoreEntry {
    ca: number;
    caMax: number;
    exam: number;
    examMax: number;
    remarks?: string;
}

export interface RecordedGrade {
    ca: string;
    exam: string;
    total: string;
    grade: string;
    position: string;
}

/** The scores of one course in one class: a row per enrolled student with Edit, computed figures and position. */
export class GradeRecordPage extends BasePage {
    constructor(page: Page) {
        super(page);
    }

    async visit(classCourseId: number | string): Promise<void> {
        await this.page.goto(`/academic/grades/class-course/${classCourseId}`);
        await this.page.waitForLoadState('networkidle');
        await expect(this.page.getByRole('columnheader', { name: 'Total Score' })).toBeVisible();
    }

    rowFor(studentName: string): Locator {
        return this.page.locator('table tbody tr').filter({ hasText: studentName });
    }

    /** The computed figures shown for a student (Name, CA, Exam, Total, Grade, Position, Updated, Action). */
    async figuresFor(studentName: string): Promise<RecordedGrade> {
        const cells = await this.rowFor(studentName).first().locator('td').allInnerTexts();
        const [, ca, exam, total, grade, position] = cells.map(c => c.trim());
        return { ca, exam, total, grade, position };
    }

    /**
     * The figures once the list shows the expected total. The list reloads after every save, so reading
     * straight after saving can still see the old numbers.
     */
    async figuresWithTotal(studentName: string, total: number): Promise<RecordedGrade> {
        await expect.poll(async () => Number((await this.figuresFor(studentName)).total), {
            message: `total shown for ${studentName}`,
            timeout: 10_000,
        }).toBe(total);
        return this.figuresFor(studentName);
    }

    private get dialog(): Locator {
        return this.page.locator('mat-dialog-container');
    }

    async openRecord(studentName: string): Promise<void> {
        await this.rowFor(studentName).locator('button').filter({ hasText: 'Edit' }).click();
        await expect(this.dialog.getByRole('heading', { name: /record grade/i })).toBeVisible();
    }

    async fill(entry: Partial<ScoreEntry>): Promise<void> {
        const fields: [string, number | string | undefined][] = [
            ['continuousAssessmentScore', entry.ca],
            ['totalContinuousAssessmentScore', entry.caMax],
            ['examScore', entry.exam],
            ['totalExamScore', entry.examMax],
        ];
        for (const [control, value] of fields) {
            if (value !== undefined) {
                await this.dialog.locator(`[formcontrolname="${control}"]`).fill(String(value));
            }
        }
        if (entry.remarks !== undefined) {
            await this.dialog.locator('textarea[formcontrolname="remarks"]').fill(entry.remarks);
        }
    }

    get submitButton(): Locator {
        return this.dialog.locator('mat-dialog-actions button.btn-primary');
    }

    /** Saves the open dialog and resolves with the API response. */
    async submit(): Promise<Response> {
        const [response] = await Promise.all([
            this.page.waitForResponse(res => /grade-records\/\d+$/.test(res.url()) && res.request().method() === 'PATCH'),
            this.submitButton.click(),
        ]);
        return response;
    }

    /** Opens the dialog for a student, enters the scores and saves. */
    async record(studentName: string, entry: ScoreEntry): Promise<Response> {
        await this.openRecord(studentName);
        await this.fill(entry);
        const response = await this.submit();
        if (response.ok()) {
            await expect(this.dialog).toBeHidden();
        }
        return response;
    }

    async cancelDialog(): Promise<void> {
        await this.dialog.locator('a[mat-dialog-close]').click();
        await expect(this.dialog).toBeHidden();
    }
}

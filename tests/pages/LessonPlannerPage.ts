import { expect, Locator, Page, Response } from '@playwright/test';
import { BasePage } from './BasePage';

export interface LessonPlanFormData {
    /** text of the lesson option, e.g. 'Plan Maths' (the course) */
    lesson?: string;
    title?: string;
    topic?: string;
    lessonDate?: string; // YYYY-MM-DD
    description?: string;
    summary?: string;
    reflection?: string;
    status?: string; // the option's label, e.g. 'Draft'
}

/** The Lesson Planner: weeks, then class courses, then plans, and the form that writes one. */
export class LessonPlannerPage extends BasePage {
    constructor(page: Page) {
        super(page);
    }

    // ── overview: Weeks > Week n > class course > plans ─────────────────────

    async visit(): Promise<void> {
        const loaded = this.page.waitForResponse(r => /lesson-planners\/weekly-overview/.test(r.url()) && r.request().method() === 'GET');
        await this.goto('/academic/lesson-planner');
        await loaded;
        await expect(this.page.getByRole('heading', { name: 'Lesson Plans' })).toBeVisible();
    }

    get addButton(): Locator {
        return this.page.getByRole('link', { name: /add lesson plan/i });
    }

    private card(text: string | RegExp): Locator {
        return this.page.locator('.card.cursor-pointer').filter({ hasText: text });
    }

    get weekCards(): Locator {
        return this.page.locator('.card.cursor-pointer').filter({ hasText: /^\s*Week \d+/ });
    }

    async openWeek(weekNumber: number): Promise<void> {
        await this.card(new RegExp(`^\\s*Week ${weekNumber}(?!\\d)`)).click();
    }

    get classCourseCards(): Locator {
        return this.page.locator('.card.cursor-pointer');
    }

    async openClassCourse(className: string, courseName: string): Promise<void> {
        await this.card(className).filter({ hasText: courseName }).click();
    }

    get planRows(): Locator {
        return this.page.locator('table.datatable tbody tr');
    }

    planRow(topic: string): Locator {
        return this.planRows.filter({ hasText: topic });
    }

    /** Walks Weeks > Week n > class course so the plans table is showing. */
    async drillTo(weekNumber: number, className: string, courseName: string): Promise<void> {
        await this.openWeek(weekNumber);
        await this.openClassCourse(className, courseName);
        await expect(this.page.locator('table.datatable')).toBeVisible();
    }

    async openPlan(topic: string): Promise<void> {
        await this.planRow(topic).getByRole('link', { name: topic }).click();
    }

    async editPlan(topic: string): Promise<void> {
        await this.planRow(topic).locator('.ti-dots-vertical').click();
        await this.planRow(topic).getByText('Edit').click();
    }

    /** Deletes through the row menu and confirms the alert. Resolves with the DELETE call. */
    async deletePlan(topic: string): Promise<Response> {
        await this.planRow(topic).locator('.ti-dots-vertical').click();
        await this.planRow(topic).getByText('Delete').click();
        const [response] = await Promise.all([
            this.page.waitForResponse(r => /lesson-planners\/\d+$/.test(r.url()) && r.request().method() === 'DELETE'),
            this.page.locator('.swal2-confirm').click(),
        ]);
        return response;
    }

    // ── the form ────────────────────────────────────────────────────────────

    async openAddForm(): Promise<void> {
        await this.addButton.click();
        await expect(this.page.getByRole('heading', { name: 'Add Lesson Plan' })).toBeVisible();
    }

    /** Lessons arrive after the teacher's profile loads, so wait for the option instead of the list. */
    async chooseLesson(text: string): Promise<void> {
        await this.page.locator('ng-select#lessonId').click();
        const option = this.page.locator('.ng-option').filter({ hasText: text }).first();
        await expect(option).toBeVisible();
        await option.click();
    }

    async fill(data: LessonPlanFormData): Promise<void> {
        if (data.lesson) await this.chooseLesson(data.lesson);
        if (data.title !== undefined) await this.setText('#title', data.title);
        if (data.topic !== undefined) await this.setText('#topic', data.topic);
        if (data.lessonDate !== undefined) await this.page.locator('#lessonDate').fill(data.lessonDate);
        if (data.description !== undefined) await this.writeDescription(data.description);
        if (data.summary !== undefined) await this.setText('#summary', data.summary);
        if (data.reflection !== undefined) await this.setText('#reflection', data.reflection);
        if (data.status) await this.page.locator('#status').selectOption({ label: data.status });
    }

    private async setText(selector: string, value: string): Promise<void> {
        const field = this.page.locator(selector);
        await field.clear();
        await field.fill(value);
    }

    /** ProseMirror only notices real key events, so type over whatever is there. */
    async writeDescription(text: string): Promise<void> {
        const editor = this.page.locator('ngx-editor .NgxEditor__Content');
        await editor.click();
        await this.page.keyboard.press('ControlOrMeta+A');
        await this.page.keyboard.press('Backspace');
        await this.page.keyboard.type(text);
    }

    async statusOptions(): Promise<string[]> {
        return (await this.page.locator('#status option').allInnerTexts()).map(o => o.trim());
    }

    get submitButton(): Locator {
        return this.page.getByRole('button', { name: /^(Create|Update)$/ });
    }

    /** Submits and resolves with the save call: a POST to create, a PATCH to update. */
    async submit(): Promise<Response> {
        const [response] = await Promise.all([
            this.page.waitForResponse(r => /lesson-planners(\/\d+)?$/.test(r.url()) && ['POST', 'PATCH'].includes(r.request().method())),
            this.submitButton.click(),
        ]);
        return response;
    }

    async expectToastMessage(text: RegExp | string): Promise<void> {
        await this.page.locator('.p-toast-message').filter({ hasText: text }).first().waitFor({ state: 'visible', timeout: 10000 });
    }
}

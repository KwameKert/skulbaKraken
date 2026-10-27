import { expect, Locator, Page, Response } from '@playwright/test';
import { BasePage } from './BasePage';

/** One lesson plan as a reader sees it, with the head teacher's review controls when they have them. */
export class LessonPlanDetailsPage extends BasePage {
    constructor(page: Page) {
        super(page);
    }

    async visit(planId: number): Promise<void> {
        const loaded = this.page.waitForResponse(r => new RegExp(`lesson-planners/${planId}$`).test(r.url()) && r.request().method() === 'GET');
        await this.goto(`/academic/lesson-planner/${planId}`);
        await loaded;
        await expect(this.page.getByRole('heading', { name: 'Lesson Plan Details' })).toBeVisible();
    }

    async expectLoaded(title: string): Promise<void> {
        await expect(this.page.getByRole('heading', { name: title, level: 5 })).toBeVisible();
    }

    get status(): Locator {
        return this.page.locator('.card-header .badge').first();
    }

    get description(): Locator {
        return this.page.locator('.wysiwyg-content');
    }

    section(heading: string): Locator {
        return this.page.locator('.card').filter({ has: this.page.getByRole('heading', { name: heading }) });
    }

    // ── review ──────────────────────────────────────────────────────────────

    get commentBox(): Locator {
        return this.page.getByPlaceholder('Add a comment...');
    }

    get commentButton(): Locator {
        return this.page.getByRole('button', { name: /^(Add|Update) Comment$/ });
    }

    get approveButton(): Locator {
        return this.page.getByRole('button', { name: 'Approve' });
    }

    get reviewButton(): Locator {
        return this.page.getByRole('button', { name: 'Set to Review' });
    }

    /**
     * The page looks up the reviewer's employee record on its own; the button does nothing until that
     * lookup has come back, so let the page settle before commenting.
     */
    async comment(text: string): Promise<Response> {
        await this.page.waitForLoadState('networkidle');
        await this.commentBox.fill(text);
        const [response] = await Promise.all([
            this.page.waitForResponse(r => /lesson-planners\/\d+\/comment$/.test(r.url()) && r.request().method() === 'PATCH'),
            this.commentButton.click(),
        ]);
        return response;
    }

    async approve(): Promise<Response> {
        const [response] = await Promise.all([
            this.page.waitForResponse(r => /lesson-planners\/\d+$/.test(r.url()) && r.request().method() === 'PATCH'),
            this.approveButton.click(),
        ]);
        return response;
    }
}

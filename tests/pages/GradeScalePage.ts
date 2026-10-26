import { expect, Page } from '@playwright/test';
import { BasePage } from './BasePage';

export interface GradeBand {
    name: string;
    min: number;
    max: number;
}

/** The score-based grade scale (A, B, C ...): which total score earns which letter. */
export class GradeScalePage extends BasePage {
    constructor(page: Page) {
        super(page);
    }

    async visit(): Promise<void> {
        await this.page.goto('/academic/grades/scores');
        await this.page.locator('table.datatable').waitFor({ state: 'visible' });
        await this.page.waitForLoadState('networkidle');
    }

    /** The bands currently defined, in list order (ID, Name, Min, Max, Status ...). */
    async bands(): Promise<(GradeBand & { status: string })[]> {
        await this.visit();
        const rows = await this.page.locator('table.datatable tbody tr').evaluateAll(trs =>
            trs.map(tr => Array.from(tr.querySelectorAll('td')).map(td => (td.textContent ?? '').trim())));
        return rows
            .filter(cells => cells.length >= 5 && /^\d+$/.test(cells[0]))
            .map(cells => ({ name: cells[1], min: Number(cells[2]), max: Number(cells[3]), status: cells[4] }));
    }

    async addBand(band: GradeBand): Promise<void> {
        await this.visit();
        await this.page.locator('a.btn-primary').filter({ hasText: /add score/i }).click();
        const dialog = this.page.locator('mat-dialog-container');
        await expect(dialog.getByRole('heading', { name: /add grade/i })).toBeVisible();
        await dialog.locator('input[formcontrolname="name"]').fill(band.name);
        await dialog.locator('input[formcontrolname="minScore"]').fill(String(band.min));
        await dialog.locator('input[formcontrolname="maxScore"]').fill(String(band.max));
        const [response] = await Promise.all([
            this.page.waitForResponse(res => /\/grades$/.test(res.url()) && res.request().method() === 'POST'),
            dialog.locator('mat-dialog-actions button.btn-primary').click(),
        ]);
        expect(response.ok(), `add band ${band.name}: status ${response.status()}`).toBeTruthy();
        await expect(dialog).toBeHidden();
    }

    /**
     * Makes sure a grade scale exists. A fresh database has none, so the standard one is created; an
     * existing scale is left alone and returned, because the scale is shared by the whole school.
     */
    async ensureScale(standard: GradeBand[]): Promise<GradeBand[]> {
        const existing = await this.bands();
        if (existing.length > 0) {
            return existing;
        }
        for (const band of standard) {
            await this.addBand(band);
        }
        return standard;
    }
}

/** The app's lookup: the first band (lowest id) whose range contains the score, both ends included. */
export function letterFor(scale: GradeBand[], score: number): string {
    return scale.find(b => score >= b.min && score <= b.max)?.name ?? '';
}

/** Whole-number bands, like most schools use. */
export const STANDARD_SCALE: GradeBand[] = [
    { name: 'A', min: 80, max: 100 },
    { name: 'B', min: 70, max: 79 },
    { name: 'C', min: 60, max: 69 },
    { name: 'D', min: 50, max: 59 },
    { name: 'E', min: 40, max: 49 },
    { name: 'F', min: 0, max: 39 },
];

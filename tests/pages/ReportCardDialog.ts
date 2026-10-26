import { expect, Locator, Page, Response } from '@playwright/test';

export interface ReportSubject {
    subject: string;
    classScore: string;
    examScore: string;
    total: string;
    grade: string;
}

/**
 * The Student Report dialog behind the master sheet's Report button: the student's figures, then a
 * Teacher Remarks section and a HeadTeacher Remarks section. Everyone who can open it can write the
 * teacher remarks; only admins and head teachers get an editor for the head teacher's.
 */
export class ReportCardDialog {
    constructor(private readonly page: Page) {}

    private get dialog(): Locator {
        return this.page.locator('mat-dialog-container');
    }

    async waitUntilOpen(): Promise<void> {
        await expect(this.dialog.getByRole('heading', { name: 'Student Report' })).toBeVisible();
        await expect(this.dialog.locator('table.datatable tbody tr').first()).toBeVisible();
    }

    /** The text beside a bold label in the header, e.g. 'Term:' */
    async headerValue(label: string): Promise<string> {
        const text = await this.dialog.locator('div').filter({ has: this.page.locator('span.fw-bold', { hasText: label }) }).last().innerText();
        return text.replace(label, '').trim();
    }

    async subjects(): Promise<ReportSubject[]> {
        const rows = this.dialog.locator('table.datatable tbody tr');
        const result: ReportSubject[] = [];
        for (let i = 0; i < await rows.count(); i++) {
            const [subject, classScore, examScore, total, grade] = (await rows.nth(i).locator('td').allInnerTexts()).map(c => c.trim());
            result.push({ subject, classScore, examScore, total, grade });
        }
        return result;
    }

    /** Matched on the whole heading: 'Teacher Remarks' is also a piece of 'HeadTeacher Remarks'. */
    private section(title: string): Locator {
        return this.dialog.locator('div').filter({ has: this.page.getByRole('heading', { name: title, exact: true }) }).last();
    }

    /** The rich-text box for a remarks section; absent when the section is read-only for this user. */
    private editor(title: string): Locator {
        return this.section(title).locator('.NgxEditor__Content');
    }

    teacherEditor(): Locator {
        return this.editor('Teacher Remarks');
    }

    headTeacherEditor(): Locator {
        return this.editor('HeadTeacher Remarks');
    }

    /** The remarks as they read, whether the section is an editor or plain text. */
    async teacherRemarks(): Promise<string> {
        return this.remarksOf('Teacher Remarks');
    }

    async headTeacherRemarks(): Promise<string> {
        return this.remarksOf('HeadTeacher Remarks');
    }

    private async remarksOf(title: string): Promise<string> {
        const editor = this.editor(title);
        const source = (await editor.count()) ? editor : this.section(title).locator('.wysiwyg-content');
        return (await source.innerText()).trim();
    }

    async writeTeacherRemarks(text: string): Promise<void> {
        await this.typeInto(this.teacherEditor(), text);
    }

    async writeHeadTeacherRemarks(text: string): Promise<void> {
        await this.typeInto(this.headTeacherEditor(), text);
    }

    /**
     * The editor is ProseMirror: it only notices real key events, so fill() leaves the form empty.
     * Replaces whatever is there, as a person would, by selecting it all and typing over it.
     */
    private async typeInto(editor: Locator, text: string): Promise<void> {
        await editor.click();
        await this.page.keyboard.press('ControlOrMeta+A');
        await this.page.keyboard.press('Backspace');
        await this.page.keyboard.type(text);
    }

    get saveButton(): Locator {
        return this.dialog.getByRole('button', { name: 'Save Report' });
    }

    /** Saves and resolves with the API response: a POST the first time a report is written, a PATCH after. */
    async save(): Promise<Response> {
        const [response] = await Promise.all([
            this.page.waitForResponse(res => /grade-records\/report(\/\d+)?$/.test(res.url()) && ['POST', 'PATCH'].includes(res.request().method())),
            this.saveButton.click(),
        ]);
        return response;
    }

    async cancel(): Promise<void> {
        await this.dialog.getByText('Cancel').click();
        await expect(this.dialog).toBeHidden();
    }
}

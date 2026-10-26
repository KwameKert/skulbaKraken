import { Page } from '@playwright/test';
import { expect } from '../fixtures';
import { ClassPage } from '../pages/ClassPage';

/** Creates a class through the Classes page (optionally with a class teacher) and returns its id. */
export async function createClass(
    page: Page,
    name: string,
    status: 'ACTIVE' | 'INACTIVE' = 'ACTIVE',
    teacherName?: string,
): Promise<number> {
    const classPage = new ClassPage(page);
    await classPage.visit();
    await classPage.clickAddClass();
    await classPage.fillForm({ name, description: 'e2e', status, teacherName });
    const [response] = await Promise.all([
        page.waitForResponse(res => /\/classes$/.test(res.url()) && res.request().method() === 'POST'),
        classPage.submitForm(),
    ]);
    expect(response.ok(), `create class ${name}: status ${response.status()}`).toBeTruthy();
    await classPage.expectToastMessage(/created successfully/i);
    return (await response.json()).data.id;
}

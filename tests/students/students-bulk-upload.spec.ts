import * as XLSX from 'xlsx';
import { authenticatedTest as test, expect } from '../fixtures';
import { BulkUploadPage } from '../pages/BulkUploadPage';
import { ClassPage } from '../pages/ClassPage';
import { StudentsPage } from '../pages/StudentsPage';
import { GuardiansPage } from '../pages/GuardiansPage';
import {
    buildCsv,
    buildWorkbook,
    makeBulkRow,
    readTemplateHeaders,
    REQUIRED_COLUMNS,
    TEMPLATE_HEADERS,
} from '../data/bulkStudents';
import { makeGuardian } from '../data/people';

/**
 * Bulk upload: the spreadsheet is parsed and validated in the browser, then posted to
 * POST /students/bulk in one request. Files are built in memory so every run uses fresh data.
 * The first test creates the class the uploaded students are enrolled into.
 */
const className = `Bulk E2E ${Date.now().toString(36)}`;

const isBulkPost = (res: { url(): string; request(): { method(): string } }) =>
    res.url().includes('/students/bulk') && res.request().method() === 'POST';

test.describe.serial('Students — bulk upload', () => {
    test('creates the class the uploads will be enrolled into', async ({ page }) => {
        const classPage = new ClassPage(page);
        await classPage.visit();
        await classPage.clickAddClass();
        await classPage.expectDialogVisible('Add');
        await classPage.fillForm({ name: className, status: 'ACTIVE' });
        await classPage.submitForm();

        await classPage.expectToastMessage(/created successfully/i);
    });

    test.describe('Page and template', () => {
        test('shows the upload form with the upload button disabled', async ({ page }) => {
            const bulk = new BulkUploadPage(page);
            await bulk.visit();

            await expect(bulk.templateLink).toBeVisible();
            await expect(bulk.uploadButton).toBeDisabled();
        });

        test('the downloadable template matches the columns the importer understands', async ({ page }) => {
            const response = await page.request.get('/assets/bulk_upload/Student_Bulk_Upload.xlsx');
            expect(response.ok()).toBeTruthy();

            const headers = readTemplateHeaders(await response.body());

            expect(headers).toEqual(expect.arrayContaining(REQUIRED_COLUMNS));
            expect(headers.sort()).toEqual([...TEMPLATE_HEADERS].sort());
        });
    });

    test.describe('Choosing a file', () => {
        test('rejects a non-Excel file with an error toast', async ({ page }) => {
            const bulk = new BulkUploadPage(page);
            await bulk.visit();

            await bulk.chooseFile(buildCsv([makeBulkRow()]));

            await bulk.expectToastMessage(/invalid file type/i);
            await expect(bulk.previewRows).toHaveCount(0);
        });

        test('shows a preview with a record count and a Ready badge for a valid file', async ({ page }) => {
            const bulk = new BulkUploadPage(page);
            await bulk.visit();

            await bulk.chooseFile(buildWorkbook([makeBulkRow(), makeBulkRow()]));

            await expect(bulk.previewRows).toHaveCount(2);
            await expect(bulk.recordBadge).toHaveText(/2 record/);
            await expect(bulk.readyBadge).toBeVisible();
        });

        test('upload stays disabled until both a class and a file are chosen', async ({ page }) => {
            const bulk = new BulkUploadPage(page);
            await bulk.visit();

            await bulk.chooseFile(buildWorkbook([makeBulkRow()]));
            await expect(bulk.uploadButton).toBeDisabled();

            await bulk.selectClass(className);
            await expect(bulk.uploadButton).toBeEnabled();
        });

        test('Remove file clears the preview and Reset clears the class too', async ({ page }) => {
            const bulk = new BulkUploadPage(page);
            await bulk.visit();
            await bulk.selectClass(className);
            await bulk.chooseFile(buildWorkbook([makeBulkRow()]));
            await expect(bulk.previewRows).toHaveCount(1);

            await bulk.removeFile();
            await expect(bulk.previewRows).toHaveCount(0);
            await expect(bulk.uploadButton).toBeDisabled();

            await bulk.chooseFile(buildWorkbook([makeBulkRow()]));
            await bulk.resetButton.click();
            await expect(bulk.previewRows).toHaveCount(0);
            await expect(bulk.uploadButton).toBeDisabled();
        });

        test('blank rows at the end of the sheet are ignored', async ({ page }) => {
            const bulk = new BulkUploadPage(page);
            await bulk.visit();

            await bulk.chooseFile(buildWorkbook([makeBulkRow(), {}, {}]));

            await expect(bulk.previewRows).toHaveCount(1);
        });
    });

    test.describe('Validation', () => {
        test('lists missing required columns and blocks the upload', async ({ page }) => {
            const bulk = new BulkUploadPage(page);
            await bulk.visit();
            await bulk.selectClass(className);

            const headers = TEMPLATE_HEADERS.filter(h => h !== 'lastName' && h !== 'gender');
            await bulk.chooseFile(buildWorkbook([makeBulkRow()], { headers }));

            await expect(bulk.missingColumnsBanner).toContainText('lastName');
            await expect(bulk.missingColumnsBanner).toContainText('gender');
            await expect(bulk.uploadButton).toBeDisabled();
        });

        test('flags bad cells: empty name, invalid email, bad gender, bad date, bad boolean', async ({ page }) => {
            const bulk = new BulkUploadPage(page);
            await bulk.visit();
            await bulk.selectClass(className);

            await bulk.chooseFile(buildWorkbook([
                makeBulkRow({ firstName: '' }),
                makeBulkRow({ email: 'not-an-email' }),
                makeBulkRow({ gender: 'UNKNOWN' }),
                makeBulkRow({ dateOfBirth: 'someday' }),
                makeBulkRow({ guardian1SmsEnabled: 'maybe' }),
            ]));

            await expect(bulk.cellErrorBanner).toContainText('5 cell error');
            await expect(bulk.errorBadge).toHaveText(/5 error/);
            await expect(bulk.errorCells).toHaveCount(5);
            await expect(bulk.uploadButton).toBeDisabled();
        });

        test('a guardian relation outside Father/Mother/Guardian/Other is flagged', async ({ page }) => {
            const bulk = new BulkUploadPage(page);
            await bulk.visit();
            await bulk.selectClass(className);

            await bulk.chooseFile(buildWorkbook([makeBulkRow({ guardian1Relation: 'UNCLE' })]));

            await expect(bulk.errorCells).toHaveCount(1);
            await expect(bulk.uploadButton).toBeDisabled();
        });


    });

    test.describe('Upload', () => {
        const first = makeBulkRow();
        const sibling = makeBulkRow({
            // same guardian as `first`: guardians are shared by phone number
            guardian1FirstName: first.guardian1FirstName,
            guardian1LastName: first.guardian1LastName,
            guardian1Email: first.guardian1Email,
            guardian1PhoneNumber: first.guardian1PhoneNumber,
        });
        const twoGuardians = (() => {
            const second = makeGuardian({ relationship: 'Mother' });
            return makeBulkRow({
                guardian2FirstName: second.firstName,
                guardian2LastName: second.lastName,
                guardian2Email: second.email,
                guardian2PhoneNumber: second.phoneNumber,
                guardian2Relation: 'MOTHER',
                guardian2SmsEnabled: true,
                guardian2EmailEnabled: false,
            });
        })();

        test('uploads several students in one request and resets the form', async ({ page }) => {
            const bulk = new BulkUploadPage(page);
            await bulk.visit();
            await bulk.selectClass(className);
            await bulk.chooseFile(buildWorkbook([first, sibling, twoGuardians]));
            await expect(bulk.recordBadge).toHaveText(/3 record/);

            const [response] = await Promise.all([page.waitForResponse(isBulkPost), bulk.uploadButton.click()]);

            expect(response.ok(), `status ${response.status()}: ${await response.text()}`).toBeTruthy();
            await bulk.expectToastMessage(/students uploaded successfully/i);
            await expect(bulk.previewRows).toHaveCount(0);
            await expect(bulk.uploadButton).toBeDisabled();
        });

        test('the uploaded students appear in the students list with a student ID', async ({ page }) => {
            const students = new StudentsPage(page);
            for (const row of [first, sibling, twoGuardians]) {
                await students.visit();
                await students.search(String(row.lastName));
                const rowLocator = students.rowByName(String(row.lastName));
                await expect(rowLocator).toBeVisible();
                await expect(rowLocator).toContainText(/\S+/);
            }
        });

        test('student details show the saved fields, the guardians and the chosen class', async ({ page }) => {
            const students = new StudentsPage(page);
            await students.visit();
            await students.search(String(twoGuardians.lastName));
            await students.clickViewInRow(String(twoGuardians.lastName));
            await expect(page).toHaveURL(/student-details\/\d+/i);

            await expect(page.getByRole('heading', { name: new RegExp(String(twoGuardians.lastName)) })).toBeVisible();
            await expect(page.getByText(/DOB\s*:\s*Jan 15, 2012/)).toBeVisible();
            await expect(page.getByText(className)).toBeVisible();
            await expect(page.getByText(/2 guardians/i)).toBeVisible();
            await expect(page.getByText(String(twoGuardians.guardian1PhoneNumber))).toBeVisible();
            await expect(page.getByText(String(twoGuardians.guardian2PhoneNumber))).toBeVisible();
        });

        test('siblings in the file share one guardian record', async ({ page }) => {
            const guardians = new GuardiansPage(page);
            await guardians.visit();

            await expect(guardians.rowByPhone(String(first.guardian1PhoneNumber))).toHaveCount(1);
        });

        test('student emails do not have to be unique (current product decision)', async ({ page }) => {
            // Decision: duplicate student emails are allowed for now. If this changes, flip the assertion.
            const sameEmail = makeBulkRow({ email: String(first.email) });
            const bulk = new BulkUploadPage(page);
            await bulk.visit();
            await bulk.selectClass(className);
            await bulk.chooseFile(buildWorkbook([sameEmail]));

            const [response] = await Promise.all([page.waitForResponse(isBulkPost), bulk.uploadButton.click()]);

            expect(response.ok(), `status ${response.status()}: ${await response.text()}`).toBeTruthy();
            await bulk.expectToastMessage(/students uploaded successfully/i);
        });


    });
});

test('the workbook builder produces a readable first sheet', () => {
    // guard for the helper itself: a broken builder would make every test above fail confusingly
    const file = buildWorkbook([makeBulkRow({ firstName: 'Ama' })]);
    const rows = XLSX.utils.sheet_to_json<string[]>(
        XLSX.read(file.buffer, { type: 'buffer' }).Sheets['Students'],
        { header: 1 },
    );
    expect(rows[0]).toEqual([...TEMPLATE_HEADERS]);
    expect(rows[1][0]).toBe('Ama');
});

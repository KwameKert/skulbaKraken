import * as XLSX from 'xlsx';
import { makeGuardian, makeStudent } from './people';

/**
 * Builders for the student bulk-upload spreadsheet. Headers match the official template
 * (skulbaApp/src/assets/bulk_upload/Student_Bulk_Upload.xlsx) in the same order.
 */
export const TEMPLATE_HEADERS = [
    'firstName', 'lastName', 'email', 'phoneNumber', 'address', 'otherNames', 'gender', 'dateOfBirth',
    'motherTongue', 'languages', 'medicalAllergies', 'medicalConditions', 'notes', 'studentId',
    'guardian1FirstName', 'guardian1LastName', 'guardian1Email', 'guardian1PhoneNumber', 'guardian1Address',
    'guardian1Relation', 'guardian1Occupation', 'guardian1SmsEnabled', 'guardian1EmailEnabled',
    'guardian2FirstName', 'guardian2LastName', 'guardian2Email', 'guardian2PhoneNumber', 'guardian2Address',
    'guardian2Relation', 'guardian2Occupation', 'guardian2SmsEnabled', 'guardian2EmailEnabled',
] as const;

/** Columns the importer refuses to run without (STUDENT_SCHEMA entries with required: true). */
export const REQUIRED_COLUMNS = [
    'firstName', 'lastName', 'gender', 'dateOfBirth', 'guardian1SmsEnabled', 'guardian1EmailEnabled',
];

export type BulkRow = Partial<Record<(typeof TEMPLATE_HEADERS)[number], string | number | boolean>>;

export interface UploadFile {
    name: string;
    mimeType: string;
    buffer: Buffer;
}

const XLSX_MIME = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

/** One valid student row with a first guardian; every call is unique per run. */
export function makeBulkRow(overrides: BulkRow = {}): BulkRow {
    const student = makeStudent();
    const guardian = makeGuardian();
    return {
        firstName: student.firstName,
        lastName: student.lastName,
        email: student.email,
        phoneNumber: student.phoneNumber,
        address: student.address,
        otherNames: student.otherNames,
        gender: 'MALE',
        dateOfBirth: '2012-01-15',
        guardian1FirstName: guardian.firstName,
        guardian1LastName: guardian.lastName,
        guardian1Email: guardian.email,
        guardian1PhoneNumber: guardian.phoneNumber,
        guardian1Address: guardian.address,
        guardian1Relation: 'FATHER',
        guardian1Occupation: guardian.occupation,
        guardian1SmsEnabled: true,
        guardian1EmailEnabled: true,
        ...overrides,
    };
}

export function buildWorkbook(
    rows: BulkRow[],
    options: { headers?: readonly string[]; name?: string } = {},
): UploadFile {
    const headers = options.headers ?? TEMPLATE_HEADERS;
    const sheet = XLSX.utils.aoa_to_sheet([
        [...headers],
        ...rows.map(row => headers.map(h => (row as Record<string, unknown>)[h] ?? '')),
    ]);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, sheet, 'Students');
    const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' }) as Buffer;
    return { name: options.name ?? 'students.xlsx', mimeType: XLSX_MIME, buffer };
}

export function buildCsv(rows: BulkRow[]): UploadFile {
    const lines = [TEMPLATE_HEADERS.join(','), ...rows.map(r => TEMPLATE_HEADERS.map(h => (r as Record<string, unknown>)[h] ?? '').join(','))];
    return { name: 'students.csv', mimeType: 'text/csv', buffer: Buffer.from(lines.join('\n')) };
}

export function readTemplateHeaders(buffer: Buffer): string[] {
    const workbook = XLSX.read(buffer, { type: 'buffer' });
    const rows = XLSX.utils.sheet_to_json<string[]>(workbook.Sheets[workbook.SheetNames[0]], { header: 1, defval: '' });
    return rows[0].map(String);
}

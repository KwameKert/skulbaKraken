import fs from 'fs';
import path from 'path';
import { makeStaff } from '../data/people';

/**
 * The timetable solver always runs its full two minutes, so flows that need lessons cannot generate
 * their own. The setup project builds this class once (tests/setup/07-timetable.spec.ts) and records it
 * here; flows read it back.
 */
export interface TimetableFixture {
    className: string;
    classId: number;
    termId: number;
    termName: string;
    teacher: ReturnType<typeof makeStaff>;
    /** the password the teacher chose at first sign-in */
    teacherPassword: string;
    courses: { name: string; classCourseId: number; periods: number }[];
    lessonCount: number;
}

const FILE = path.resolve(__dirname, '..', '..', 'playwright', '.data', 'timetable.json');

export function saveTimetableFixture(fixture: TimetableFixture): void {
    fs.mkdirSync(path.dirname(FILE), { recursive: true });
    fs.writeFileSync(FILE, JSON.stringify(fixture, null, 2));
}

export function loadTimetableFixture(): TimetableFixture {
    if (!fs.existsSync(FILE)) {
        throw new Error('No timetable fixture: run `npm run test:setup` (or `npm run test:fresh`) first.');
    }
    return JSON.parse(fs.readFileSync(FILE, 'utf8'));
}

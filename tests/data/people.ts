import type { GuardianFormData, StudentFormData } from '../pages/StudentsPage';
import type { StaffFormData } from '../pages/StaffPage';

/**
 * Builders for people test data. Every call returns values that are unique per run
 * (name suffix, email and phone) so specs can be re-run without a truncate and
 * Edit/Delete tests can target the record they created instead of a literal name.
 */

let sequence = 0;

function tag(): string {
    sequence += 1;
    // base36 timestamp + counter + a little randomness keeps parallel workers apart
    return `${Date.now().toString(36)}${sequence}${Math.floor(Math.random() * 36).toString(36)}`;
}

function uniquePhone(prefix: string): string {
    // 3-digit prefix + 7 random digits = a 10 digit local number
    return `${prefix}${String(Math.floor(Math.random() * 1e7)).padStart(7, '0')}`;
}

export function makeStudent(overrides: Partial<StudentFormData> = {}): StudentFormData {
    const id = tag();
    return {
        firstName: 'Kwame',
        lastName: `Asante${id}`,
        otherNames: 'Junior',
        gender: 'Male',
        dateOfBirth: '01/15/2012',
        phoneNumber: uniquePhone('024'),
        email: `student.${id}@example.com`,
        status: 'Active',
        address: '12 Test Street, Accra',
        notes: 'E2E test student',
        ...overrides,
    };
}

export function makeGuardian(overrides: Partial<GuardianFormData> = {}): GuardianFormData {
    const id = tag();
    return {
        firstName: 'Kofi',
        lastName: `Mensah${id}`,
        email: `guardian.${id}@example.com`,
        phoneNumber: uniquePhone('020'),
        relationship: 'Father',
        address: '5 Guardian Road, Accra',
        occupation: 'Engineer',
        ...overrides,
    };
}

export function makeStaff(overrides: Partial<StaffFormData> = {}): StaffFormData {
    const id = tag();
    return {
        employeeType: 'Teacher',
        firstName: 'Ama',
        lastName: `Owusu${id}`,
        gender: 'Female',
        primaryContactNumber: uniquePhone('054'),
        email: `staff.${id}@example.com`,
        dateOfJoining: '01/10/2024',
        dateOfBirth: '03/22/1990',
        maritalStatus: 'Single',
        workExperience: '5 years',
        emergencyContactName: 'Yaw Owusu',
        emergencyContactNumber: uniquePhone('020'),
        address: '8 Staff Lane, Kumasi',
        status: 'Active',
        notes: 'E2E test staff',
        ...overrides,
    };
}

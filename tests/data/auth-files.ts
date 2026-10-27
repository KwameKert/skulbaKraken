import path from 'path';

const AUTH_DIR = path.join(__dirname, '..', '..', 'playwright', '.auth');

/** The test administrator's saved session: what every project except `auth` and `setup` starts from. */
export const AUTH_FILE = path.join(AUTH_DIR, 'admin.json');

/** The tenant owner's saved session: only the setup step that creates the administrator uses it. */
export const TENANT_AUTH_FILE = path.join(AUTH_DIR, 'tenant.json');

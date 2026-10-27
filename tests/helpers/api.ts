import { Browser, Page } from '@playwright/test';
import { signIn } from './session';

export interface ApiResult {
    status: number;
    body: string;
}

/** A signed-in browser that can also call the API with the token the app itself is using. */
export interface ApiSession {
    page: Page;
    /** e.g. https://api.example.com/users/api/v1 */
    users: string;
    /** e.g. https://api.example.com/academics/api/v1 */
    academics: string;
    close: () => Promise<void>;
    get: (url: string) => Promise<ApiResult>;
    send: (method: 'POST' | 'PUT' | 'PATCH' | 'DELETE', url: string, data?: unknown) => Promise<ApiResult>;
}

/**
 * Signs in as someone (staff email or guardian phone) and borrows the bearer token from the app's
 * next API call. Direct calls prove what an endpoint allows regardless of what the UI hides.
 */
export async function openApiSession(browser: Browser, username: string, password: string): Promise<ApiSession> {
    const session = await signIn(browser, username, password);
    const page = session.page;
    await page.waitForURL(/\/dashboard/);
    const [request] = await Promise.all([
        page.waitForRequest(r => !!r.headers()['authorization'] && /\/(users|academics)\/api\//.test(r.url())),
        page.reload(),
    ]);
    const headers = { Authorization: request.headers()['authorization'] };
    const origin = new URL(request.url()).origin;
    return {
        page,
        users: `${origin}/users/api/v1`,
        academics: `${origin}/academics/api/v1`,
        close: session.close,
        get: async url => {
            const res = await page.request.get(url, { headers });
            return { status: res.status(), body: await res.text() };
        },
        send: async (method, url, data) => {
            const res = await page.request.fetch(url, { method, headers, data });
            return { status: res.status(), body: await res.text() };
        },
    };
}

/** Only the payload counts as a leak: error bodies echo the requested path (which holds what the caller typed). */
export function payloadOf(body: string): string {
    try {
        return JSON.stringify(JSON.parse(body).data ?? '');
    } catch {
        return '';
    }
}

// JWT expiry is used only to end the UI session; the server still verifies tokens.
export function getTokenExpiryMs(token) {
    try {
        const payload = token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
        const { exp } = JSON.parse(atob(payload));
        return typeof exp === 'number' && Number.isFinite(exp) ? exp * 1000 : null;
    } catch { return null; }
}
export function isTokenExpired(token, now = Date.now()) {
    const expiry = getTokenExpiryMs(token);
    return expiry !== null && now >= expiry;
}

export const IDLE_TIMEOUT_MS = 30 * 60 * 1000;
export const LAST_ACTIVITY_STORAGE_KEY = 'hrms:lastActivityAt';

export function watchIdleSession(readLastActivity, onExpired, {
    timeoutMs = IDLE_TIMEOUT_MS,
    now = Date.now,
    setTimer = setTimeout,
    clearTimer = clearTimeout,
} = {}) {
    let timer;
    let stopped = false;
    const check = () => {
        if (stopped) return;
        clearTimer(timer);
        const lastActivity = Number(readLastActivity());
        if (!Number.isFinite(lastActivity) || lastActivity <= 0) {
            stopped = true;
            onExpired();
            return;
        }

        const remaining = timeoutMs - (now() - lastActivity);
        if (remaining <= 0) {
            stopped = true;
            onExpired();
        } else {
            timer = setTimer(check, remaining);
        }
    };
    check();
    return { check, stop() { stopped = true; clearTimer(timer); } };
}

export function watchSessionExpiry(readToken, onExpired, {
    now = Date.now, setTimer = setTimeout, clearTimer = clearTimeout,
} = {}) {
    let timer;
    let stopped = false;
    const check = () => {
        if (stopped) return;
        clearTimer(timer);
        const token = readToken();
        const expiry = getTokenExpiryMs(token);
        if (!token || (expiry !== null && now() >= expiry)) {
            stopped = true;
            onExpired();
        } else if (expiry !== null) {
            timer = setTimer(check, Math.min(expiry - now(), 2147483647));
        }
    };
    check();
    return { check, stop() { stopped = true; clearTimer(timer); } };
}

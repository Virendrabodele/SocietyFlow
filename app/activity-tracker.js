(function () {
    const STORAGE_KEY = 'societyActivityLog';
    const WEBHOOK_KEY = 'googleSheetsWebhookUrl';
    const SPREADSHEET_KEY = 'https://docs.google.com/spreadsheets/d/1oNWJRk4QltrcKVvdI9HZ5stJMJ955mIvDh6mjhJ_jIQ/edit?gid=0#gid=0';

    function safeParse(value, fallback) {
        try { return JSON.parse(value); } catch (e) { return fallback; }
    }

    function getCurrentUser() {
        return safeParse(localStorage.getItem('currentUser'), null);
    }

    function buildPayload(eventType, details) {
        const user = getCurrentUser();
        return {
            eventType,
            page: window.location.pathname.split('/').pop() || 'unknown',
            timestamp: new Date().toISOString(),
            userId: user ? user.id : null,
            userEmail: user ? user.email : null,
            userRole: user ? user.role : null,
            spreadsheetUrl: localStorage.getItem(SPREADSHEET_KEY) || null,
            details: details || {}
        };
    }

    function persistActivity(payload) {
        const logs = safeParse(localStorage.getItem(STORAGE_KEY), []);
        logs.push(payload);
        localStorage.setItem(STORAGE_KEY, JSON.stringify(logs.slice(-1000)));
    }

    function sendToWebhook(payload) {
        const webhook = localStorage.getItem(WEBHOOK_KEY);
        if (!webhook) return;

        fetch(webhook, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
            keepalive: true,
            mode: 'cors'
        }).catch(() => {
            // Ignore network errors so UI flow never breaks.
        });
    }

    function recordEvent(eventType, details) {
        const payload = buildPayload(eventType, details);
        persistActivity(payload);
        sendToWebhook(payload);
    }

    function trackPageView() {
        recordEvent('page_view', {
            title: document.title,
            url: window.location.href
        });
    }

    function trackNavigationClicks() {
        document.addEventListener('click', function (event) {
            const link = event.target.closest('a[href]');
            if (!link) return;

            recordEvent('nav_click', {
                text: (link.textContent || '').trim(),
                href: link.getAttribute('href')
            });
        });
    }

    window.recordSocietyFlowEvent = recordEvent;

    document.addEventListener('DOMContentLoaded', function () {
        trackPageView();
        trackNavigationClicks();
    });
})();

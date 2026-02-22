(function () {
    const STORAGE_KEY = 'societyActivityLog';
    const WEBHOOK_KEY = 'googleSheetsWebhookUrl';
    const SPREADSHEET_KEY = 'googleSpreadsheetUrl';

    function safeParse(value, fallback) {
        if (!value) return fallback;
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
        const logs = safeParse(localStorage.getItem(STORAGE_KEY), []) || [];
        logs.push(payload);
        localStorage.setItem(STORAGE_KEY, JSON.stringify(logs.slice(-1000)));
    }

    function isAppsScriptUrl(url) {
        return typeof url === 'string' && /script\.google\.com\/macros\/s\//.test(url);
    }

    function getWebhookUrl() {
        const configuredWebhook = localStorage.getItem(WEBHOOK_KEY);
        if (configuredWebhook) return configuredWebhook;

        // Fallback: if user accidentally pasted Apps Script URL into spreadsheet field.
        const spreadsheetUrl = localStorage.getItem(SPREADSHEET_KEY);
        if (isAppsScriptUrl(spreadsheetUrl)) return spreadsheetUrl;

        return '';
    }


    function sendToWebhook(payload) {
        const webhook = getWebhookUrl();
        if (!webhook) {
            console.log('[ActivityTracker] No webhook URL configured');
            return;
        }

        console.log('[ActivityTracker] Sending to webhook:', webhook);
        console.log('[ActivityTracker] Payload:', payload);

        fetch(webhook, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
            keepalive: true,
            mode: 'cors'
        }).then(r => {
            console.log('[ActivityTracker] Webhook response status:', r.status);
            return r.text();
        }).then(text => {
            console.log('[ActivityTracker] Webhook response:', text);
        }).catch(e => {
            console.log('[ActivityTracker] Webhook error:', e.message);
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
    window.getSocietyFlowWebhookUrl = getWebhookUrl;

    document.addEventListener('DOMContentLoaded', function () {
        trackPageView();
        trackNavigationClicks();
    });
})();

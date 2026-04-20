# Quickstart: Testing GDPR Logging Locally

## 1. Running the Frontend
The changes to the landing page rely on a lightweight analytics snippet. 
To start the dev server and test:
```bash
cd frontend
npm run dev
```

## 2. Emulating the Tracker
Since the default Plausible Analytics script requires the origin to be the configured `graditone.com` or explicitly set for localhost testing, you can test custom interaction triggers by inspecting the global `window.plausible` or checking the Network tab for `/api/event` requests. 

1. Open http://localhost:5173
2. Open the Browser Console. Type `window.plausible('cta_click')`
3. Verify that zero persistent cookies are set in Application > Cookies.
4. Verify no calls to local storage or IndexedDB are placing user identifiers.

# Verification

Local beta verification uses synthetic fixtures for X and OpenAI, temporary SQLite stores and synthetic Windows DPAPI credentials. The standard test runner blocks external fetch calls.

Run npm run check and npm test on Windows with Node.js 24+ for current results. The suite covers manual-only sync (including legacy intervals), explicit sync confirmation, Engage start_time filters and single-page cost bounds, source-only localization, queue behavior and credential separation.

No public account data, personal usage counts or live credential values are included in this report. Live API calls are not required to validate a source release. A green test suite does not prove every provider permission or real-world operation.

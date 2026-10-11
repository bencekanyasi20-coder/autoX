# autoX

**Your X workspace, on your own Windows computer.** Made by [benkany.com](https://benkany.com).

A small personal dashboard for X analytics, followers, conversations and writing. Green and black interface, English and Hungarian languages, zero npm runtime dependencies. Uses the official X API and optional OpenAI API with your own credentials. Independent project; not affiliated with X or OpenAI.

## Download and run

1. [Download autoX for Windows](https://github.com/bencekanyasi20-coder/autoX/releases/latest/download/autoX-windows.zip).
2. Extract the entire ZIP into a folder you control.
3. Double-click **download.cmd** for first-time setup. It downloads the pinned official Node.js 24.21.0 x64 runtime from nodejs.org and verifies its SHA-256 before extraction. No administrator access or global Node installation required.
4. Later, double-click **start.cmd**. Open http://127.0.0.1:4317.
5. In Settings, select English, enter your own X OAuth Client ID and optional Client Secret, then connect your account.

Requires Windows 10/11 x64, Windows PowerShell and internet access for setup and API actions. If Node.js 24+ is already installed, start.cmd works directly. This is an unsigned beta with script launchers, not a signed installer.

[Latest release](https://github.com/bencekanyasi20-coder/autoX/releases/latest) · [English guide](public/guide.en.html) · [Security notes](SECURITY.md)

## Connect X

Create your own app in the [X Developer Console](https://console.x.com/), enable OAuth 2.0 user authentication and register this exact callback:

~~~text
http://127.0.0.1:4317/oauth/callback
~~~

Enter the OAuth 2.0 Client ID, not the OAuth 1.0 Consumer Key. An app-only Bearer Token is not a substitute for user authorization. The app requests post read/write, user read, follow read/write, media upload and offline access permissions. Your API access and billing must support the endpoints used.

## API costs and refresh behavior

**There is no automatic data refresh.** Opening the app, changing pages, selecting periods and the top Refresh button only read saved local data. X sync runs only after clicking Sync and accepting a separate cost confirmation.

- A full sync may make dozens of paginated requests. One click does not mean one billable request. The local daily write limit does not cap read costs or provider billing.
- Engage searches are manual, use at most one result page (100 posts), and do not automatically fetch additional pages. Narrow your search when more results exist.
- Public account analysis and full timeline/inbox/follower sync can make multiple requests. Avoid repeating them unnecessarily.
- Previously approved scheduled posts can run while automation is enabled and the computer/app are running. Those operations may perform an identity check before sending. Pause automation to stop scheduled sends.
- OpenAI requests require your own key and an explicit click/confirmation. API providers bill your accounts; no credits are included.

## Features

- Post rankings, impressions and engagement; 7/14/28-day local analytics.
- Followers, following, mutuals, non-followbacks and changes from recorded snapshots.
- Inbox for mentions/replies; drafts, manual reply sending and scheduling.
- Engage search with language and 1/3/7-day filters.
- AI writing assistance, inspiration library, public account analysis and leads.
- Image attachments, a local queue and explicit delivery states.
- CSV/JSON export and a read-only local MCP server.
- English/Hungarian UI with a Drevin green/black theme.

Historical follower changes cannot be reconstructed before the first complete snapshot. Removal detection requires two complete misses. Metrics are cumulative values grouped by publication date, not exact daily reach. Direct messages are drafted locally and sent manually on X. An uncertain publication is not automatically retried.

## Privacy

API secrets are stored using Windows DPAPI under the current Windows user in **%LOCALAPPDATA%\Xauto\credentials.dpapi**. Workspace data stays in **workspace.sqlite** in the same folder. No credentials, real account data, logs or exports are bundled in this repository or release. Do not upload your local data directory.

The app binds only to 127.0.0.1. It trusts your Windows session and is not a multi-user service; local software running as you can access the app and potentially decrypt your secrets. Do not expose it through a tunnel or reverse proxy. See SECURITY.md for limitations.

## Development

~~~sh
npm run check
npm test
npm start
~~~

No npm install is needed. Tests inject synthetic provider responses. The standard test command blocks non-loopback fetch calls, including X and OpenAI endpoints. Running the test suite does not require real API credentials. Windows is required for the DPAPI vault tests.

MCP: run **node mcp.mjs** with a client supporting stdio MCP. It reads the local workspace; it does not send posts or refresh X. Optionally set XAUTO_DATA_DIR to an isolated folder; PORT changes the local server port (update your callback registration accordingly).

## Beta status

Offline regression tests cover storage, credentials, OAuth, request boundaries, scheduling, pagination and UI behavior. This is not a security certification or a guarantee of bug-free operation. Provider permissions, pricing and limits can change. Live publication and AI access depend on your configuration.

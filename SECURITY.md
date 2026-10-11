# Security and privacy

## What is included

This repository contains application source, synthetic tests and documentation only. Releases are assembled from an explicit file list without the parent workspace or its Git history. Local databases, encrypted credentials, logs, exports and runtime downloads are excluded.

Before the initial publication, source was checked for known credential patterns, private-key blocks and exact matches to configured local credentials (including common encoded forms). No matches were found. A separate static review inspected the credential vault, API routes, exports, provider targets, error handling and UI escaping. These checks cannot prove the absence of every vulnerability.

## Boundaries

- Windows DPAPI encrypts credentials for the current Windows user. Encryption does not protect against malware or another process running under that same user.
- The HTTP server binds to loopback, validates Host/Origin, uses per-process CSRF tokens for mutations and serves an explicit asset allowlist. It has no user/password login: local processes are trusted and can read workspace data and invoke actions.
- X/OpenAI tokens are server-side and omitted from state/config/export responses. The OAuth Client ID is a public identifier and may appear in Settings. Provider error bodies and authorization headers are not logged or returned.
- X/OpenAI actions send the necessary request data to those services. There is no background data sync. User-approved scheduled publication is a separate feature.
- API calls use fixed HTTPS provider hosts and reject redirects. UI renders external content as escaped text. The MCP server exposes read-only workspace tools without the vault.
- Never publish your data folder, screenshots of private account data, local exports or credentials. Gitignore is a convenience, not a secret scanner.

## Reporting

Do not put credentials or private workspace data in a public issue. If a key was exposed, revoke it with the issuing provider. For security concerns, use the contact options at https://benkany.com and describe the issue without including secrets.

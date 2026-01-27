---
name: e2e-auth
description: Set up E2E authentication for Playwright testing on protected pages. Use this skill when you need to authenticate before navigating to protected routes like /train, /generate, /dashboard, or any page that requires a logged-in user. This skill provides the session token and cookie setup needed for Playwright browser automation.
allowed-tools: Bash, Read
---

# E2E Authentication for Playwright Testing

When testing protected pages with Playwright MCP, you must authenticate first. The auth cookie is HttpOnly and CANNOT be set via `document.cookie`.

## Step 1: Discover Ports

```bash
.claude/scripts/get-dev-ports.sh --json
```

Parse the JSON output to get `api.port` and `web.port`.

## Step 2: Get Session Token

```bash
./scripts/e2e-auth-setup.sh --json
```

This returns:
```json
{
  "token": "...",
  "cookie": {
    "name": "better-auth.session_token",
    "value": "...",
    "domain": "localhost",
    "path": "/",
    "httpOnly": true,
    "secure": false,
    "sameSite": "Lax"
  },
  "user": "test@pexit.local"
}
```

## Step 3: Set Cookie in Playwright

Use `browser_run_code` with `page.context().addCookies()`:

```javascript
async (page) => {
  await page.context().addCookies([{
    name: 'better-auth.session_token',
    value: '{TOKEN_FROM_STEP_2}',
    domain: 'localhost',
    path: '/',
    httpOnly: true,
    secure: false,
    sameSite: 'Lax'
  }]);

  await page.goto('http://localhost:{web_port}/train');
  await page.waitForTimeout(2000);

  return { url: page.url(), authenticated: true };
}
```

**CRITICAL**: Use `addCookies()`, NOT `document.cookie`. The auth cookie is HttpOnly.

## Step 4: Verify Authentication

After setting the cookie and navigating:
- Page should NOT redirect to `/auth`
- User initials (e.g., "EU") should appear in header
- Protected content should be visible

## Test User Credentials

| Field | Value |
|-------|-------|
| Email | `test@pexit.local` |
| Password | `test-password-123` |

## Troubleshooting

**"Failed to authenticate test user"**
- Check API is running: `curl http://localhost:8080/health`
- Seed test user: `API_URL=http://localhost:8080 bun run scripts/seed-test-user.ts`

**Cookie not being set**
- MUST use `page.context().addCookies()` via `browser_run_code`
- Domain must be `localhost` (no port number)

**Still redirected to /auth**
- Token may be expired - get a fresh one
- Check cookie domain matches the page domain

## FORBIDDEN Operations

After authenticating, DO NOT trigger:
- POST /api/lora/train (costs $2-5)
- Bulk image generation (>5 images)
- Video generation

Allowed: UI verification, form validation, single image gen, API schema checks

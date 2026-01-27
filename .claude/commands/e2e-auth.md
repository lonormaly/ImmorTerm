---
name: e2e-auth
description: "Set up E2E authentication for Playwright testing on protected pages. Use this skill when you need to authenticate before navigating to protected routes like /train, /generate, /dashboard, or any page that requires a logged-in user. This skill provides the session token and cookie setup needed for Playwright browser automation."
model: haiku
category: utility
---

# /e2e-auth - E2E Authentication Setup

Sets up authentication for Playwright E2E testing. Run this BEFORE navigating to protected pages.

## What This Skill Does

1. Discovers the API URL (local or remote environment)
2. Ensures the test user exists (seeds if needed)
3. Gets a valid session token
4. Provides the exact Playwright code to set the cookie

## Supported Environments

| Environment | Web URL | API URL | Cookie Domain | Use Case |
|-------------|---------|---------|---------------|----------|
| `local` | `http://localhost:{port}` | `http://localhost:{port}` | `localhost` | Local dev without Tilt |
| `tilt` | `http://localhost:3010` | `http://localhost:3001` | `localhost` | Tilt remote mode (dev-shai) |
| `dev-shai` | `https://dev-shai.pexitai.com` | `https://api.dev-shai.pexitai.com` | `dev-shai.pexitai.com` | Direct remote HTTPS |
| `dev` | `https://dev.pexitai.com` | `https://api.dev.pexitai.com` | `dev.pexitai.com` | CI/CD deployed dev |

## Usage

```bash
# Local development (auto-detects port)
./scripts/e2e-auth-setup.sh --json

# Tilt remote mode (localhost ports → dev-shai cluster)
./scripts/e2e-auth-setup.sh --env tilt --json

# Remote dev-shai environment (direct HTTPS)
./scripts/e2e-auth-setup.sh --env dev-shai --json

# Remote dev environment (CI/CD deployed)
./scripts/e2e-auth-setup.sh --env dev --json
```

## Execution Steps

### Step 1: Get Session Token

Run the auth setup script with the appropriate environment:

```bash
# For local testing
./scripts/e2e-auth-setup.sh --json

# For remote testing
./scripts/e2e-auth-setup.sh --env dev --json
```

**Expected output (JSON):**
```json
{
  "token": "...",
  "cookie": {
    "name": "__Secure-better-auth.session_token",
    "value": "...",
    "domain": "dev.pexitai.com",
    "path": "/",
    "httpOnly": true,
    "secure": true,
    "sameSite": "Lax"
  },
  "user": "test@pexit.local",
  "urls": {
    "web": "https://dev.pexitai.com",
    "api": "https://api.dev.pexitai.com"
  },
  "env": "dev"
}
```

### Step 2: Set Cookie in Playwright

Use Playwright's `browser_run_code` to set the cookie:

```typescript
// For HTTPS (remote environments)
await page.context().addCookies([{
  name: '__Secure-better-auth.session_token',
  value: '{TOKEN}',
  domain: 'dev.pexitai.com',
  path: '/',
  httpOnly: true,
  secure: true,
  sameSite: 'Lax'
}]);

// For HTTP (localhost)
await page.context().addCookies([{
  name: 'better-auth.session_token',
  value: '{TOKEN}',
  domain: 'localhost',
  path: '/',
  httpOnly: true,
  secure: false,
  sameSite: 'Lax'
}]);
```

**IMPORTANT**: Use `addCookies()`, NOT `document.cookie`. The auth cookie is HttpOnly and cannot be set via JavaScript.

### Step 3: Navigate to Protected Page

Now you can navigate to any protected page:

```typescript
// Remote
await page.goto('https://dev.pexitai.com/train');
await page.goto('https://dev.pexitai.com/generate');
await page.goto('https://dev.pexitai.com/trainings');

// Local
await page.goto('http://localhost:3010/train');
```

## Complete Example

```javascript
// In Playwright browser_run_code for remote testing:
async (page) => {
  // Set auth cookie for dev environment
  await page.context().addCookies([{
    name: '__Secure-better-auth.session_token',
    value: 'YOUR_TOKEN_HERE',
    domain: 'dev.pexitai.com',
    path: '/',
    httpOnly: true,
    secure: true,
    sameSite: 'Lax'
  }]);

  // Navigate to protected page
  await page.goto('https://dev.pexitai.com/train');
  await page.waitForTimeout(2000);

  return { url: page.url(), authenticated: true };
}
```

## Cookie Name Differences

| Environment | Cookie Name | Secure |
|-------------|-------------|--------|
| Local (HTTP) | `better-auth.session_token` | `false` |
| Remote (HTTPS) | `__Secure-better-auth.session_token` | `true` |

The `__Secure-` prefix is required for cookies with `secure: true` on HTTPS.

## Test User Credentials

| Field | Value |
|-------|-------|
| Email | `test@pexit.local` |
| Password | `test-password-123` |

## Troubleshooting

**"Failed to authenticate test user"**
- Check API is running: `curl https://api.dev.pexitai.com/health`
- Verify `AUTH_SKIP_EMAIL_VERIFICATION=true` is set in API env
- For remote: ensure test user is seeded in database
- For remote: ensure `/api/auth/dev-session` endpoint is enabled

**Cookie not being set**
- Use `page.context().addCookies()`, not `document.cookie`
- Use correct domain (no port number)
- Use correct cookie name (`__Secure-` prefix for HTTPS)

**Still redirected to /auth**
- Token may be expired - get a fresh one
- Check cookie domain matches the page domain
- Verify secure flag matches protocol (true for HTTPS)

## FORBIDDEN Operations

After authenticating, DO NOT trigger these expensive operations:
- ❌ `POST /api/lora/train` - Costs $2-5 per run
- ❌ Bulk image generation (>5 images)
- ❌ Video generation

✅ ALLOWED: UI verification, form validation, single image gen, API schema checks

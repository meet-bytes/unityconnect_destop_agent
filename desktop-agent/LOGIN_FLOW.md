# Login Flow – Desktop Agent & Frontend

Complete login flow: desktop app opens browser → user logs in on web → frontend redirects back to desktop app. Includes recommended “already logged in” UX and frontend implementation.

---

## Overview

- **Desktop app** opens: `http://192.168.10.20:3000/login?redirect_uri=unityagent`
- **Frontend** must:
  - If `redirect_uri=unityagent`: after login (or when already logged in), send user back via `unityagent://auth?token=...&refreshToken=...`
  - Otherwise: normal web login (e.g. redirect to dashboard)

---

## Login Flow Steps

### 1. User starts login in desktop app
- User clicks **Login** in the desktop app
- Button shows loading: "Opening browser..."
- Helper text: "Please complete login in your browser. Waiting for authentication..."

### 2. Browser opens
- Desktop app opens the default browser
- URL: `http://192.168.10.20:3000/login?redirect_uri=unityagent`
- Button returns to "Login"

### 3. User logs in (browser / frontend)
- User enters credentials **or** is already logged in
- Frontend reads `redirect_uri=unityagent` from the URL
- **Not logged in:** show login form → after success, redirect to `unityagent://auth?token=...&refreshToken=...` **or** go to dashboard (see table below)
- **Already logged in:** show **“You're already logged in”** with **[Open in Desktop Agent]** and **[Go to Dashboard]** (recommended; see below)

### 4. Protocol callback
- Desktop app gets `unityagent://auth?token=...&refreshToken=...` (via second-instance or queue file)
- Tokens are stored in `auth.json`, window is shown/focused, `auth:success` is sent to renderer

### 5. Desktop UI
- Login section hidden, agent section shown, user info displayed, success message then cleared

---

## Recommended: “Already logged in” screen

When the user is **already logged in** and the agent opens the login page, **do not** auto-redirect. Show a short screen:

1. Message: **“You're already logged in”**
2. **“Open in Desktop Agent”** → `window.location.href = 'unityagent://auth?token=...&refreshToken=...'`
3. **“Go to Dashboard”** → `navigate('/dashboard')`

So the user explicitly chooses: continue in agent or in web app.

| Approach | UX |
|----------|-----|
| Auto-redirect when already logged in | Page can flash and agent opens without explanation. |
| **“Already logged in” + two buttons** | Clear message and explicit choice. |

### When to show what

| Scenario | What to show |
|----------|-------------------------------|
| Not logged in + `/login?redirect_uri=unityagent` | Login form → after submit, redirect to `unityagent://auth?...` |
| **Already logged in + `/login?redirect_uri=unityagent`** | **“You're already logged in” + [Open in Desktop Agent] [Go to Dashboard]** |
| Already logged in + `/login` (no param) | Redirect to dashboard |
| Not logged in + `/login` | Login form → after submit, go to dashboard |

### Example UI (already logged in)

```
┌─────────────────────────────────────────┐
│  You're already logged in               │
│                                          │
│  [ Open in Desktop Agent ]  [ Dashboard ]│
└─────────────────────────────────────────┘
```

---

## Frontend implementation

### 1. Detect desktop agent request

```typescript
const urlParams = new URLSearchParams(window.location.search);
const redirectUri = urlParams.get('redirect_uri');
const isDesktopAgent = redirectUri === 'unityagent';
```

### 2. After form submit: conditional redirect

```typescript
const onSubmit = async (data: LoginFormData) => {
  setIsLoading(true);
  try {
    const { accessToken, refreshToken } = await authService.login(data);

    Cookies.set(TOKEN_KEY, accessToken, { expires: 7 });
    Cookies.set(REFRESH_TOKEN_KEY, refreshToken, { expires: 30 });

    if (isDesktopAgent) {
      const redirectUrl = `unityagent://auth?token=${encodeURIComponent(accessToken)}&refreshToken=${encodeURIComponent(refreshToken)}`;
      window.location.href = redirectUrl;
      return;
    }

    navigate('/dashboard');
  } catch (error) {
    console.error('[Login] Error:', error);
    setIsLoading(false);
  }
};
```

### 3. Already logged in: choice screen (recommended)

```typescript
const accessToken = Cookies.get(TOKEN_KEY);
const refreshToken = Cookies.get(REFRESH_TOKEN_KEY);
const alreadyLoggedIn = Boolean(accessToken && refreshToken);

if (alreadyLoggedIn && isDesktopAgent) {
  return (
    <div className="already-logged-in-card">
      <h2>You're already logged in</h2>
      <p>Choose where to continue:</p>
      <div className="actions">
        <button
          onClick={() => {
            const url = `unityagent://auth?token=${encodeURIComponent(accessToken!)}&refreshToken=${encodeURIComponent(refreshToken!)}`;
            window.location.href = url;
          }}
        >
          Open in Desktop Agent
        </button>
        <button onClick={() => navigate('/dashboard')}>Go to Dashboard</button>
      </div>
    </div>
  );
}
```

### 4. Complete LoginPage example

```typescript
import { useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import Cookies from 'js-cookie';
import { authService } from './services/authService';
import { TOKEN_KEY, REFRESH_TOKEN_KEY } from './constants';

const LoginPage = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const redirectUri = searchParams.get('redirect_uri');
  const isDesktopAgent = redirectUri === 'unityagent';

  const accessToken = Cookies.get(TOKEN_KEY);
  const refreshToken = Cookies.get(REFRESH_TOKEN_KEY);
  const alreadyLoggedIn = Boolean(accessToken && refreshToken);

  // Already logged in + normal web → dashboard
  useEffect(() => {
    if (alreadyLoggedIn && !isDesktopAgent) {
      navigate('/dashboard');
    }
  }, [alreadyLoggedIn, isDesktopAgent, navigate]);

  // Already logged in + desktop agent → choice screen
  if (alreadyLoggedIn && isDesktopAgent) {
    return (
      <div className="already-logged-in-card">
        <h2>You're already logged in</h2>
        <p>Choose where to continue:</p>
        <div className="actions">
          <button onClick={() => { window.location.href = `unityagent://auth?token=${encodeURIComponent(accessToken!)}&refreshToken=${encodeURIComponent(refreshToken!)}`; }}>
            Open in Desktop Agent
          </button>
          <button onClick={() => navigate('/dashboard')}>Go to Dashboard</button>
        </div>
      </div>
    );
  }

  const onSubmit = async (data: LoginFormData) => {
    setIsLoading(true);
    try {
      const { accessToken, refreshToken } = await authService.login(data);
      Cookies.set(TOKEN_KEY, accessToken, { expires: 7 });
      Cookies.set(REFRESH_TOKEN_KEY, refreshToken, { expires: 30 });

      if (isDesktopAgent) {
        window.location.href = `unityagent://auth?token=${encodeURIComponent(accessToken)}&refreshToken=${encodeURIComponent(refreshToken)}`;
        return;
      }
      navigate('/dashboard');
    } catch (error) {
      console.error('[Login] Error:', error);
      setIsLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)}>
      {isDesktopAgent && <p className="info-text">Logging in to Unity Communications Desktop Agent...</p>}
      {/* ... rest of login form ... */}
    </form>
  );
};
```

---

## Flow diagram

```
Desktop app: user clicks "Login"
    ↓
Opens: http://192.168.10.20:3000/login?redirect_uri=unityagent
    ↓
Frontend: redirect_uri=unityagent?
    ↓
User already logged in? (has cookies)
    ├─ YES → "You're already logged in"
    │         [ Open in Desktop Agent ]  [ Go to Dashboard ]
    └─ NO  → Login form
              ↓
         After login → unityagent://auth?token=...&refreshToken=...
    ↓
Desktop app receives URL (second-instance or queue file)
    ↓
Token stored, window shown, auth:success → agent UI
```

---

## Configuration (desktop app)

In `desktop-agent/config/appConfig.js`:

```javascript
LOGIN_URL = "http://192.168.10.20:3000/login?redirect_uri=unityagent"
LOGIN_TIMEOUT_MS = 1 * 60 * 1000  // 1 minute
PROTOCOL_SCHEME = "unityagent"
PROTOCOL_AUTH_PATH = "auth"
```

---

## Features (desktop app)

- **Frontend-driven redirect** – Frontend redirects to `unityagent://auth?...`; no backend redirect needed.
- **Visual feedback** – Spinner, status text, timeout.
- **Error handling** – Network/browser errors, timeout, invalid callback.
- **Protocol** – second-instance (Windows/Linux), queue file fallback (Linux), open-url (macOS).
- **Tokens** – Stored in `auth.json`, JWT expiry check, refresh support.

---

## Testing

1. **Desktop agent flow:** Click Login in app → complete login in browser → redirect to `unityagent://auth?...` → app shows agent UI.
2. **Web-only flow:** Open `/login` without `redirect_uri` → after login, redirect to dashboard.
3. **Already logged in + agent:** With valid session, open `/login?redirect_uri=unityagent` → “You're already logged in” with [Open in Desktop Agent] and [Go to Dashboard].

---

## Troubleshooting

### Browser doesn’t open
- Check `LOGIN_URL` in `config/appConfig.js`
- Network and default browser settings

### Browser doesn’t redirect after login
- Redirect only when `redirect_uri=unityagent` and after successful login
- Ensure `window.location.href = 'unityagent://auth?token=...&refreshToken=...'` runs (e.g. `console.log` before it)
- Run `./scripts/register-protocol.sh`; try Chrome/Firefox/Edge

### Protocol callback not received by desktop app
- See **PROTOCOL_TROUBLESHOOTING.md**
- App must be running when redirect happens (queue file fallback on Linux)

### Token not stored / UI doesn’t update
- Check `auth.json` in app userData; token format in URL; renderer `auth:success` listener and main process protocol handling

---

## Related

- **Protocol issues (handler, queue file, desktop entry):** `PROTOCOL_TROUBLESHOOTING.md`
- **Desktop app files:** `config/appConfig.js`, `main.js`, `renderer/renderer.js`, `scripts/register-protocol.sh`, `scripts/unityagent-handler.sh`

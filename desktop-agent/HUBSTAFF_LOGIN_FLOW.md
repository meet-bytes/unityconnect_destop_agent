# Hubstaff-Like Login Flow Implementation

## Overview

This document describes the complete login flow implementation, similar to Hubstaff's desktop application authentication pattern.

## Login Flow Steps

### 1. User Initiates Login
- User clicks the **"Login"** button in the desktop app
- Button shows loading spinner: "Opening browser..."
- Cancel button is hidden initially

### 2. Browser Opens
- Desktop app opens the system default browser
- Login page URL: `http://192.168.10.20:3000/login` (no redirect_uri needed)
- Button returns to normal state: "Login"
- Helper text shows: "Please complete login in your browser. Waiting for authentication..."

### 3. User Logs In (Browser Frontend)
- User enters credentials on the web login page
- Frontend calls login API and receives tokens (`accessToken`, `refreshToken`)
- **Frontend redirects to protocol URL**: `unityagent://auth?token=...&refreshToken=...`
- Frontend handles the redirect using `window.location.href = redirectUrl`

### 4. Protocol Callback Received
- Desktop app receives the `unityagent://` protocol callback
- Token is extracted and stored securely in `auth.json`
- Desktop app window is shown and focused automatically
- `auth:success` event is sent to renderer

### 5. UI Updates
- Renderer receives `auth:success` event
- Login section is hidden
- Agent section is shown
- User info is displayed
- Success message: "Login successful! Redirecting..."
- Cancel button is hidden
- Loading spinner is hidden

## Key Features

### ✅ Frontend-Driven Redirect
- Frontend handles redirect after successful login
- No backend changes needed - frontend redirects to protocol URL
- Simple and flexible approach

### ✅ Visual Feedback
- Loading spinner on login button during browser opening
- Clear status messages at each step
- Cancel button appears while waiting for callback
- Success message with auto-hide

### ✅ Error Handling
- Network errors: "Network offline or unreachable..."
- Browser errors: "Could not open browser..."
- Timeout handling: Auto-timeout after 1 minute (configurable)
- Invalid callback: "Invalid authentication URL. No token found."

### ✅ Protocol Handling
- Supports protocol callback when app is already running
- Supports protocol callback when app is closed (launches app)
- Handles second-instance events (Windows/Linux)
- Handles `open-url` events (macOS)

### ✅ Token Management
- Secure storage in `auth.json` (app userData directory)
- JWT expiry validation on startup and read
- Automatic token cleanup on expiry
- Refresh token support

## Configuration

All timing and URLs are configurable in `config/appConfig.js`:

```javascript
LOGIN_BASE_URL = "http://192.168.10.20:3000/login"
LOGIN_TIMEOUT_MS = 1 * 60 * 1000  // 1 minute
PROTOCOL_SCHEME = "unityagent"
PROTOCOL_AUTH_PATH = "auth"
```

## Frontend Requirements

Your frontend login form must:

1. Call login API and receive tokens (`accessToken`, `refreshToken`)
2. Store tokens in cookies (optional, for web session)
3. Redirect to protocol URL: `unityagent://auth?token=...&refreshToken=...`

### Frontend Code Example

```typescript
const onSubmit = async (data: LoginFormData) => {
  setIsLoading(true);
  try {
    const { accessToken, refreshToken } = await authService.login(data);

    // Store tokens in cookies (optional, for web session)
    Cookies.set(TOKEN_KEY, accessToken, { expires: 7 });
    Cookies.set(REFRESH_TOKEN_KEY, refreshToken, { expires: 30 });

    // Redirect to desktop app protocol URL
    const redirectUrl = `unityagent://auth?token=${encodeURIComponent(accessToken)}&refreshToken=${encodeURIComponent(refreshToken)}`;
    window.location.href = redirectUrl;
    
    // Optional: Include userInfo if available
    // const userInfo = { name: user.name, email: user.email };
    // const redirectUrl = `unityagent://auth?token=${encodeURIComponent(accessToken)}&refreshToken=${encodeURIComponent(refreshToken)}&userInfo=${encodeURIComponent(JSON.stringify(userInfo))}`;
    return;
  } catch (error) {
    // Handle login error
    setIsLoading(false);
  }
};
```

**Note:** The backend login API just needs to return tokens - no redirect handling required!

## Testing the Flow

1. **Start the app**: `npm start`
2. **Click Login**: Should open browser
3. **Complete login in browser**: Enter credentials
4. **Verify redirect**: Browser should redirect to `unityagent://auth?...`
5. **Check desktop app**: Should show agent section with user info

## Troubleshooting

### Browser doesn't open
- Check `LOGIN_BASE_URL` in config
- Verify network connectivity
- Check default browser settings

### Protocol callback not received
- Run `./scripts/register-protocol.sh` to register protocol handler
- Check console logs for protocol URL reception
- Verify frontend redirect uses correct protocol scheme (`unityagent://auth`)
- Check browser console for any errors when redirecting

### Token not stored
- Check `auth.json` in app userData directory
- Verify token format in URL parameters
- Check console logs for parsing errors

### UI doesn't update after login
- Check browser console for `auth:success` event
- Verify renderer event listeners are registered
- Check main.js logs for protocol handling

## Files Modified

1. **config/appConfig.js**: `buildLoginURL()` returns login page URL (frontend handles redirect)
2. **main.js**: Protocol callback handling for `unityagent://auth?token=...&refreshToken=...`
3. **renderer/index.html**: Added loading spinner elements
4. **renderer/styles.css**: Added spinner styles and button states
5. **renderer/renderer.js**: Enhanced login flow with loading states and better feedback

## Frontend Integration

The frontend login form should redirect to the protocol URL after successful authentication. The desktop app will automatically receive the callback and store the tokens.

## Next Steps

- [ ] Test with actual backend login endpoint
- [ ] Verify protocol registration on target platforms
- [ ] Test error scenarios (network offline, invalid token, etc.)
- [ ] Add user info display in UI
- [ ] Implement token refresh flow

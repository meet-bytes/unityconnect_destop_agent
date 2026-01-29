# Frontend Redirect Guide

## Issue: Browser doesn't redirect after login

If clicking Login completes successfully but the browser doesn't redirect to `unityagent://auth?...`, check the following:

## Frontend Code Requirements

Your login form handler must redirect to the protocol URL after successful authentication:

```typescript
const onSubmit = async (data: LoginFormData) => {
  setIsLoading(true);
  try {
    // 1. Call login API
    const { accessToken, refreshToken } = await authService.login(data);

    // 2. Store tokens (optional, for web session)
    Cookies.set(TOKEN_KEY, accessToken, { expires: 7 });
    Cookies.set(REFRESH_TOKEN_KEY, refreshToken, { expires: 30 });

    // 3. CRITICAL: Redirect to protocol URL
    const redirectUrl = `unityagent://auth?token=${encodeURIComponent(accessToken)}&refreshToken=${encodeURIComponent(refreshToken)}`;
    
    console.log('[Login] Redirecting to:', redirectUrl); // Debug log
    
    window.location.href = redirectUrl;
    return;
  } catch (error) {
    console.error('[Login] Error:', error);
    setIsLoading(false);
    // Show error to user
  }
};
```

## Common Issues & Fixes

### Issue 1: Redirect code not executing

**Symptoms:** Login succeeds but no redirect happens

**Debug steps:**
1. Add `console.log` before `window.location.href`
2. Check browser console for errors
3. Verify `accessToken` and `refreshToken` are received

**Fix:** Ensure the redirect code is in the `try` block after successful login

### Issue 2: Browser blocks protocol redirect

**Symptoms:** Console shows "Launched external handler" but nothing happens

**Possible causes:**
- Browser security settings
- Popup blocker
- Protocol handler not registered

**Fixes:**
- Ensure protocol handler is registered: `./scripts/register-protocol.sh`
- Try different browsers (Chrome, Firefox, Edge)
- Check browser console for security warnings

### Issue 3: Error before redirect

**Symptoms:** Login fails or throws error

**Debug steps:**
1. Check browser console for errors
2. Verify API response format matches expected structure
3. Check network tab for API call status

**Fix:** Handle errors properly and ensure redirect only happens on success

### Issue 4: Redirect happens but app doesn't receive it

**Symptoms:** Browser redirects but desktop app doesn't respond

**Debug steps:**
1. Check Electron app console for `[protocol]` logs
2. Verify app is running when redirect happens
3. Test protocol handler: `xdg-open 'unityagent://auth?token=test123'`

**Fix:** See `PROTOCOL_TROUBLESHOOTING.md`

## Complete Frontend Example

```typescript
import Cookies from 'js-cookie';

const TOKEN_KEY = 'accessToken';
const REFRESH_TOKEN_KEY = 'refreshToken';

interface LoginResponse {
  accessToken: string;
  refreshToken: string;
}

const onSubmit = async (data: LoginFormData) => {
  setIsLoading(true);
  setError(null);
  
  try {
    // Call your login API
    const response = await fetch('http://192.168.10.20:3000/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    
    if (!response.ok) {
      throw new Error('Login failed');
    }
    
    const { accessToken, refreshToken }: LoginResponse = await response.json();
    
    if (!accessToken || !refreshToken) {
      throw new Error('Invalid response: missing tokens');
    }
    
    // Store tokens (optional)
    Cookies.set(TOKEN_KEY, accessToken, { expires: 7 });
    Cookies.set(REFRESH_TOKEN_KEY, refreshToken, { expires: 30 });
    
    // Build protocol URL
    const protocolUrl = `unityagent://auth?token=${encodeURIComponent(accessToken)}&refreshToken=${encodeURIComponent(refreshToken)}`;
    
    console.log('[Login] Success! Redirecting to desktop app...');
    console.log('[Login] URL:', protocolUrl);
    
    // Redirect to desktop app
    window.location.href = protocolUrl;
    
    // Optional: Show message while redirecting
    // setMessage('Redirecting to desktop app...');
    
  } catch (error) {
    console.error('[Login] Error:', error);
    setError(error instanceof Error ? error.message : 'Login failed');
    setIsLoading(false);
  }
};
```

## Testing the Redirect

### Test 1: Manual redirect test
Open browser console and run:
```javascript
window.location.href = 'unityagent://auth?token=test123&refreshToken=test456';
```

Expected: Desktop app should receive the callback

### Test 2: Check redirect URL format
After login, before redirect, log the URL:
```typescript
console.log('Redirect URL:', redirectUrl);
```

Should be: `unityagent://auth?token=...&refreshToken=...`

### Test 3: Verify tokens are received
```typescript
console.log('Tokens received:', { accessToken, refreshToken });
```

Both should be non-empty strings

## Browser Compatibility

- ✅ Chrome/Chromium: Works
- ✅ Firefox: Works
- ✅ Edge: Works
- ⚠️ Safari: May require user permission for protocol handlers

## Security Notes

- Always use `encodeURIComponent()` for token values
- Don't log full tokens in production
- Handle errors gracefully
- Consider adding a timeout if redirect doesn't happen

## Still Not Working?

1. **Check browser console** for errors or warnings
2. **Check network tab** to verify API call succeeds
3. **Add debug logs** before redirect
4. **Test protocol handler** directly: `xdg-open 'unityagent://auth?token=test'`
5. **Verify app is running** when redirect happens
6. **Check Electron console** for `[protocol]` logs

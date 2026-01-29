const fs = require("fs");
const path = require("path");
const { app } = require("electron");
const { TOKEN_EXPIRY_CLOCK_SKEW_SECONDS } = require("../config/appConfig");

let cachedAuthPath = null;

const resolveAuthPath = () => {
  if (cachedAuthPath) return cachedAuthPath;
  const baseDir =
    (app && app.getPath ? app.getPath("userData") : null) ||
    path.join(__dirname, "..", "storage");

  if (!fs.existsSync(baseDir)) {
    fs.mkdirSync(baseDir, { recursive: true });
  }

  cachedAuthPath = path.join(baseDir, "auth.json");
  return cachedAuthPath;
};

const ensureAuthFile = () => {
  const authPath = resolveAuthPath();
  if (!fs.existsSync(authPath)) {
    fs.writeFileSync(
      authPath,
      JSON.stringify({ 
        token: null, 
        refreshToken: null,
        userInfo: null, 
        loggedIn: false 
      }, null, 2),
      "utf-8",
    );
  }
};

/**
 * Decode JWT payload without verification (client-side expiry check only).
 * Returns null if token is invalid or malformed.
 */
const decodeJwtPayload = (token) => {
  if (!token || typeof token !== "string") return null;
  try {
    const parts = token.split(".");
    if (parts.length !== 3) return null;
    const payload = parts[1];
    if (!payload) return null;
    // base64url: replace - with +, _ with /, add padding if needed
    const base64 = payload.replace(/-/g, "+").replace(/_/g, "/");
    const padded = base64 + "==".slice(0, (4 - (base64.length % 4)) % 4);
    const decoded = Buffer.from(padded, "base64").toString("utf-8");
    return JSON.parse(decoded);
  } catch (e) {
    return null;
  }
};

/**
 * Check if JWT is expired (exp claim in seconds).
 * Returns true if expired or invalid.
 */
const isTokenExpired = (token) => {
  const payload = decodeJwtPayload(token);
  if (!payload || typeof payload.exp !== "number") return true;
  // exp is in seconds; allow configurable clock skew
  const now = Math.floor(Date.now() / 1000);
  const skew = TOKEN_EXPIRY_CLOCK_SKEW_SECONDS || 60; // Default 60s if config not available
  return payload.exp < now - skew;
};

const readAuth = () => {
  ensureAuthFile();
  const authPath = resolveAuthPath();
  try {
    const raw = fs.readFileSync(authPath, "utf-8");
    const data = JSON.parse(raw || '{"token":null,"refreshToken":null,"userInfo":null,"loggedIn":false}');
    const token = data.token || null;
    const refreshToken = data.refreshToken || null;
    const userInfo = data.userInfo || null;

    // Validate token on read: if expired, treat as not logged in and clear stored auth
    let loggedIn = Boolean(data.loggedIn && token);
    if (loggedIn && isTokenExpired(token)) {
      console.warn("[authService] Token expired, clearing auth");
      // Use skipRead=true to prevent infinite recursion (writeAuth -> readAuth -> writeAuth)
      writeAuth({ token: null, refreshToken: null, userInfo: null, loggedIn: false }, true);
      loggedIn = false;
    }

    return {
      token: loggedIn ? token : null,
      refreshToken: loggedIn ? refreshToken : null,
      userInfo: loggedIn ? userInfo : null,
      loggedIn,
    };
  } catch (err) {
    console.error("Failed to read auth file:", err);
    return { token: null, refreshToken: null, userInfo: null, loggedIn: false };
  }
};

const writeAuth = (data, skipRead = false) => {
  ensureAuthFile();
  const authPath = resolveAuthPath();
  let current = { token: null, refreshToken: null, userInfo: null, loggedIn: false };
  if (!skipRead) {
    try {
      const raw = fs.readFileSync(authPath, "utf-8");
      const parsed = JSON.parse(raw || '{"token":null,"refreshToken":null,"userInfo":null,"loggedIn":false}');
      current = {
        token: parsed.token || null,
        refreshToken: parsed.refreshToken || null,
        userInfo: parsed.userInfo || null,
        loggedIn: Boolean(parsed.loggedIn && parsed.token),
      };
    } catch (_err) {
      // Use defaults if read fails
    }
  }
  const updated = {
    ...current,
    ...data,
    loggedIn: Boolean(data.token || current.token),
  };
  fs.writeFileSync(authPath, JSON.stringify(updated, null, 2), "utf-8");
};

const setToken = (token, refreshToken = null, userInfo = null) => {
  writeAuth({ token, refreshToken, userInfo, loggedIn: true });
};

const getToken = () => {
  const auth = readAuth();
  return auth.token;
};

const getRefreshToken = () => {
  const auth = readAuth();
  return auth.refreshToken;
};

const getUserInfo = () => {
  const auth = readAuth();
  return auth.userInfo;
};

const isLoggedIn = () => {
  const auth = readAuth();
  return auth.loggedIn;
};

const logout = () => {
  writeAuth({ token: null, refreshToken: null, userInfo: null, loggedIn: false });
};

const parseTokenFromURL = (url, protocolScheme = "unityagent") => {
  try {
    const urlObj = new URL(url);
    const expectedProtocol = `${protocolScheme}:`;
    if (urlObj.protocol !== expectedProtocol) {
      return null;
    }
    
    // Support both "token" (for accessToken) and "accessToken" parameter names
    const token = urlObj.searchParams.get("token") || urlObj.searchParams.get("accessToken");
    if (!token) {
      return null;
    }
    
    // Extract refreshToken if provided
    const refreshToken = urlObj.searchParams.get("refreshToken");
    
    // Optionally extract user info from URL parameters
    const userInfoParam = urlObj.searchParams.get("userInfo");
    let userInfo = null;
    if (userInfoParam) {
      try {
        userInfo = JSON.parse(decodeURIComponent(userInfoParam));
      } catch (e) {
        console.warn("Failed to parse userInfo from URL:", e);
      }
    }
    
    return { token, refreshToken: refreshToken || null, userInfo };
  } catch (err) {
    console.error("Failed to parse token from URL:", err);
    return null;
  }
};

/**
 * Validate token on startup. If expired, clear auth and return false.
 */
const validateTokenOnStartup = () => {
  const auth = readAuth();
  if (!auth.token) return { valid: false, reason: "no_token" };
  if (isTokenExpired(auth.token)) {
    logout();
    return { valid: false, reason: "expired" };
  }
  return { valid: true };
};

module.exports = {
  setToken,
  getToken,
  getRefreshToken,
  getUserInfo,
  isLoggedIn,
  logout,
  parseTokenFromURL,
  readAuth,
  isTokenExpired,
  validateTokenOnStartup,
};

import { IncomingMessage } from "node:http";
import { CookiesManager } from "../../../core/utils/cookie.js";
import { response } from "../../../core/utils/net.js";
import { CUSTOM_AUTH_REQUIRED_FIELDS, ENTRAID_FULL_NAME, SWA_CLI_APP_PROTOCOL } from "../../../core/constants.js";
import { DEFAULT_CONFIG } from "../../../config.js";
import { encryptAndSign, extractPostLoginRedirectUri, hashStateGuid, newNonceWithExpiration } from "../../../core/utils/auth.js";
import { OpenIdHelper } from "../../../core/utils/openidHelper.js";
import { logger } from "../../../core/utils/logger.js";
import authLoginProviderEmulator from "./auth-login-provider.js";

export const normalizeAuthProvider = function (providerName?: string) {
  if (providerName === ENTRAID_FULL_NAME) {
    return "aad";
  }
  return providerName?.toLowerCase() || "";
};

/**
 * For the `aad` custom auth provider, when the user's `staticwebapp.config.json`
 * references AAD env vars (clientIdSettingName / clientSecretSettingName) but
 * those env vars are NOT set, we fall back to the SWA local auth emulator
 * instead of hard-failing with a 400.
 *
 * This restores the pre-2.0.3 behaviour where `/.auth/login/aad` worked in
 * local dev without requiring developers to provision a real tenant just to
 * run the CLI. See https://github.com/Azure/static-web-apps-cli/issues/947.
 *
 * Returns `true` iff this is AAD, the config names env vars, and at least one
 * of them is unset — i.e. the user is clearly in local-dev mode.
 */
export const shouldFallbackToAadEmulator = function (providerName: string, customAuth?: SWAConfigFileAuth): boolean {
  if (providerName !== "aad") {
    return false;
  }
  const registration = customAuth?.identityProviders?.[ENTRAID_FULL_NAME]?.registration;
  const clientIdSettingName = registration?.clientIdSettingName;
  const clientSecretSettingName = registration?.clientSecretSettingName;
  // The config must reference env vars; if either name is missing entirely
  // that's a config-level error and should surface as 400 (handled below by
  // `checkCustomAuthConfigFields`).
  if (!clientIdSettingName || !clientSecretSettingName) {
    return false;
  }
  const clientIdValue = process.env[clientIdSettingName];
  const clientSecretValue = process.env[clientSecretSettingName];
  return !clientIdValue || !clientSecretValue;
};

export const checkCustomAuthConfigFields = function (context: Context, providerName: string, customAuth?: SWAConfigFileAuth) {
  const generateResponse = function (msg: string) {
    return {
      context,
      status: 400,
      headers: { ["Content-Type"]: "text/plain" },
      body: msg,
    };
  };

  if (!CUSTOM_AUTH_REQUIRED_FIELDS[providerName]) {
    context.res = response(generateResponse(`Provider '${providerName}' not found`));
    return false;
  }

  const requiredFields = CUSTOM_AUTH_REQUIRED_FIELDS[providerName];
  const configFileProviderName = providerName === "aad" ? ENTRAID_FULL_NAME : providerName;
  const authConfigs: Record<string, string> = {};

  for (const field of requiredFields) {
    const settingName = customAuth?.identityProviders?.[configFileProviderName]?.registration?.[field];
    if (!settingName) {
      context.res = response(generateResponse(`${field} not found for '${providerName}' provider`));
      return false;
    }

    // Special case for aad where the openIdIssuer is in the config file itself rather than the env
    if (providerName === "aad" && field === "openIdIssuer") {
      authConfigs[field] = settingName;
    } else {
      const settingValue = process.env[settingName];
      if (!settingValue) {
        context.res = response(generateResponse(`${settingName} not found in env for '${providerName}' provider`));
        return false;
      }

      authConfigs[field] = settingValue;
    }
  }

  return authConfigs;
};

const httpTrigger = async function (context: Context, request: IncomingMessage, customAuth?: SWAConfigFileAuth) {
  await Promise.resolve();

  const providerName: string = normalizeAuthProvider(context.bindingData?.provider);

  // Restore pre-2.0.3 behaviour for local dev: if the AAD env vars referenced
  // by the user's config aren't set, delegate to the local auth emulator
  // instead of hard-failing. See #947.
  if (shouldFallbackToAadEmulator(providerName, customAuth)) {
    logger.silly(`AAD env vars not set — falling back to the SWA local auth emulator for '/.auth/login/aad'`);
    return authLoginProviderEmulator(context, request);
  }

  const authFields = checkCustomAuthConfigFields(context, providerName, customAuth);
  if (!authFields) {
    return;
  }

  const state = newNonceWithExpiration();

  const authContext: AuthContext = {
    authNonce: state,
    postLoginRedirectUri: extractPostLoginRedirectUri(SWA_CLI_APP_PROTOCOL, request.headers.host, request.url),
  };

  const authContextCookieString = JSON.stringify(authContext);
  const authContextCookieEncrypted = encryptAndSign(authContextCookieString);
  const authContextCookie = authContextCookieEncrypted ? btoa(authContextCookieEncrypted) : undefined;

  const hashedState = hashStateGuid(state);
  const redirectUri = `${SWA_CLI_APP_PROTOCOL}://${DEFAULT_CONFIG.host}:${DEFAULT_CONFIG.port}`;

  let location;
  switch (providerName) {
    case "google":
      location = `https://accounts.google.com/o/oauth2/v2/auth?response_type=code&client_id=${authFields?.clientIdSettingName}&redirect_uri=${redirectUri}/.auth/login/google/callback&scope=openid+profile+email&state=${hashedState}`;
      break;
    case "github":
      location = `https://github.com/login/oauth/authorize?response_type=code&client_id=${authFields?.clientIdSettingName}&redirect_uri=${redirectUri}/.auth/login/github/callback&scope=read:user&state=${hashedState}`;
      break;
    case "aad":
      const authorizationEndpoint = await new OpenIdHelper(authFields?.openIdIssuer, authFields?.clientIdSettingName).getAuthorizationEndpoint();
      location = `${authorizationEndpoint}?response_type=code&client_id=${authFields?.clientIdSettingName}&redirect_uri=${redirectUri}/.auth/login/aad/callback&scope=openid+profile+email&state=${hashedState}`;
      break;
    case "facebook":
      location = `https://facebook.com/v11.0/dialog/oauth?client_id=${authFields?.appIdSettingName}&redirect_uri=${redirectUri}/.auth/login/facebook/callback&scope=openid&state=${hashedState}&response_type=code`;
      break;
    case "twitter":
      location = `https://twitter.com/i/oauth2/authorize?response_type=code&client_id=${authFields?.consumerKeySettingName}&redirect_uri=${redirectUri}/.auth/login/twitter/callback&scope=users.read%20tweet.read&state=${hashedState}&code_challenge=challenge&code_challenge_method=plain`;
      break;
    default:
      break;
  }

  const cookiesManager = new CookiesManager(request.headers.cookie);
  if (!authContextCookie) {
    cookiesManager.addCookieToDelete("StaticWebAppsAuthContextCookie");
  } else {
    cookiesManager.addCookieToSet({
      name: "StaticWebAppsAuthContextCookie",
      value: authContextCookie,
      domain: DEFAULT_CONFIG.host,
      path: "/",
      secure: true,
      httpOnly: true,
    });
  }

  context.res = response({
    context,
    cookies: cookiesManager.getCookies(),
    status: 302,
    headers: {
      status: 302,
      Location: location,
    },
    body: "",
  });
  return;
};

export default httpTrigger;

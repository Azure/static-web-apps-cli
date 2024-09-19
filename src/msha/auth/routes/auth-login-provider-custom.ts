import { IncomingMessage } from "node:http";
import { CookiesManager } from "../../../core/utils/cookie.js";
import { response } from "../../../core/utils/net.js";
import { CUSTOM_AUTH_REQUIRED_FIELDS, ENTRAID_FULL_NAME, SWA_CLI_APP_PROTOCOL } from "../../../core/constants.js";
import { DEFAULT_CONFIG } from "../../../config.js";
import { encryptAndSign, extractPostLoginRedirectUri, hashStateGuid, newNonceWithExpiration } from "../../../core/utils/auth.js";

export const normalizeAuthProvider = function (providerName?: string) {
  if (providerName === ENTRAID_FULL_NAME) {
    return "aad";
  }
  return providerName?.toLowerCase() || "";
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
      location = `${authFields?.openIdIssuer}/authorize?response_type=code&client_id=${authFields?.clientIdSettingName}&redirect_uri=${redirectUri}/.auth/login/aad/callback&scope=openid+profile+email&state=${hashedState}`;
      break;
    case "facebook":
      location = `https://facebook.com/v11.0/dialog/oauth?client_id=${authFields?.appIdSettingName}&redirect_uri=${redirectUri}/.auth/login/facebook/callback&scope=openid&state=${hashedState}&response_type=code`;
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

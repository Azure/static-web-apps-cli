import { IncomingMessage } from "node:http";
import { CookiesManager } from "../../../core/utils/cookie.js";
import { response } from "../../../core/utils/net.js";
import { ENTRAID_FULL_NAME, SUPPORTED_CUSTOM_AUTH_PROVIDERS, SWA_CLI_APP_PROTOCOL } from "../../../core/constants.js";
import { DEFAULT_CONFIG } from "../../../config.js";
import { encryptAndSign, extractPostLoginRedirectUri, hashStateGuid, newNonceWithExpiration } from "../../../core/utils/auth.js";

export const normalizeAuthProvider = (providerName?: string) => {
  if (providerName === ENTRAID_FULL_NAME) {
    return "aad";
  }
  return providerName?.toLowerCase() || "";
};

const httpTrigger = async function (context: Context, request: IncomingMessage, customAuth?: SWAConfigFileAuth) {
  await Promise.resolve();

  const providerName: string = normalizeAuthProvider(context.bindingData?.provider);

  if (!SUPPORTED_CUSTOM_AUTH_PROVIDERS.includes(providerName)) {
    context.res = response({
      context,
      status: 400,
      headers: { ["Content-Type"]: "text/plain" },
      body: `Provider '${providerName}' not found`,
    });
    return;
  }

  const clientIdSettingName =
    customAuth?.identityProviders?.[providerName == "aad" ? ENTRAID_FULL_NAME : providerName]?.registration?.clientIdSettingName;

  if (!clientIdSettingName) {
    context.res = response({
      context,
      status: 400,
      headers: { ["Content-Type"]: "text/plain" },
      body: `ClientIdSettingName not found for '${providerName}' provider`,
    });
    return;
  }

  const clientId = process.env[clientIdSettingName];

  if (!clientId) {
    context.res = response({
      context,
      status: 400,
      headers: { ["Content-Type"]: "text/plain" },
      body: `ClientId not found for '${providerName}' provider`,
    });
    return;
  }

  let aadIssuer;
  if (providerName == "aad") {
    aadIssuer = customAuth?.identityProviders?.[ENTRAID_FULL_NAME]?.registration?.openIdIssuer;

    if (!aadIssuer) {
      context.res = response({
        context,
        status: 400,
        headers: { ["Content-Type"]: "text/plain" },
        body: `openIdIssuer not found for '${providerName}' provider`,
      });
      return;
    }
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
      location = `https://accounts.google.com/o/oauth2/v2/auth?response_type=code&client_id=${clientId}&redirect_uri=${redirectUri}/.auth/login/google/callback&scope=openid+profile+email&state=${hashedState}`;
      break;
    case "github":
      location = `https://github.com/login/oauth/authorize?response_type=code&client_id=${clientId}&redirect_uri=${redirectUri}/.auth/login/github/callback&scope=read:user&state=${hashedState}`;
      break;
    case "aad":
      location = `${aadIssuer}/authorize?response_type=code&client_id=${clientId}&redirect_uri=${redirectUri}/.auth/login/aad/callback&scope=openid+profile+email&state=${hashedState}`;
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

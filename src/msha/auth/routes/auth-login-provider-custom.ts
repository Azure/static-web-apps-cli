import { IncomingMessage } from "node:http";
import { CookiesManager } from "../../../core/utils/cookie.js";
import { response } from "../../../core/utils/net.js";
import { SWA_CLI_APP_PROTOCOL } from "../../../core/constants.js";
import { DEFAULT_CONFIG } from "../../../config.js";
import { encryptAndSign, extractPostLoginRedirectUri, hashStateGuid, newNonceWithExpiration } from "../../../core/utils/auth.js";

const httpTrigger = async function (context: Context, request: IncomingMessage, customAuth?: SWAConfigFileAuth) {
  await Promise.resolve();

  const providerName = context.bindingData?.provider?.toLowerCase() || "";

  if (providerName != "github" && providerName != "google") {
    context.res = response({
      context,
      status: 404,
      headers: { ["Content-Type"]: "text/plain" },
      body: `Provider '${providerName}' not found`,
    });
    return;
  }

  const clientIdSettingName = customAuth?.identityProviders?.[providerName]?.registration?.clientIdSettingName;

  if (!clientIdSettingName) {
    context.res = response({
      context,
      status: 404,
      headers: { ["Content-Type"]: "text/plain" },
      body: `ClientIdSettingName not found for '${providerName}' provider`,
    });
    return;
  }

  const clientId = process.env[clientIdSettingName];

  if (!clientId) {
    context.res = response({
      context,
      status: 404,
      headers: { ["Content-Type"]: "text/plain" },
      body: `ClientId not found for '${providerName}' provider`,
    });
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

  const location =
    providerName === "google"
      ? `https://accounts.google.com/o/oauth2/v2/auth?response_type=code&client_id=${clientId}&redirect_uri=${redirectUri}/.auth/login/google/callback&scope=openid+profile+email&state=${hashedState}`
      : `https://github.com/login/oauth/authorize?response_type=code&client_id=${clientId}&redirect_uri=${redirectUri}/.auth/login/github/callback&scope=read:user&state=${hashedState}`;

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

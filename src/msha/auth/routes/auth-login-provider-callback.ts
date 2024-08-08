import * as http from "node:http";
import * as https from "node:https";
import * as querystring from "node:querystring";

import { CookiesManager, decodeAuthContextCookie, validateAuthContextCookie } from "../../../core/utils/cookie.js";
import { parseUrl, response } from "../../../core/utils/net.js";
import {
  ENTRAID_FULL_NAME,
  CUSTOM_AUTH_ISS_MAPPING,
  CUSTOM_AUTH_TOKEN_ENDPOINT_MAPPING,
  CUSTOM_AUTH_USER_ENDPOINT_MAPPING,
  SUPPORTED_CUSTOM_AUTH_PROVIDERS,
  SWA_CLI_API_URI,
  SWA_CLI_APP_PROTOCOL,
} from "../../../core/constants.js";
import { DEFAULT_CONFIG } from "../../../config.js";
import { encryptAndSign, hashStateGuid, isNonceExpired } from "../../../core/utils/auth.js";
import { normalizeAuthProvider } from "./auth-login-provider-custom.js";

const getAuthClientPrincipal = async function (
  authProvider: string,
  codeValue: string,
  clientId: string,
  clientSecret: string,
  openIdIssuer: string = "",
) {
  let authToken: string;

  try {
    const authTokenResponse = (await getOAuthToken(authProvider, codeValue!, clientId, clientSecret, openIdIssuer)) as string;
    let authTokenParsed;
    try {
      authTokenParsed = JSON.parse(authTokenResponse);
    } catch (e) {
      authTokenParsed = querystring.parse(authTokenResponse);
    }
    authToken = authTokenParsed["access_token"] as string;
  } catch (error) {
    console.error(`Error in getting OAuth token: ${error}`);
    return null;
  }

  if (!authToken) {
    return null;
  }

  try {
    const user = (await getOAuthUser(authProvider, authToken)) as { [key: string]: string };

    const userDetails = user["login"] || user["email"];
    const name = user["name"];
    const givenName = user["given_name"];
    const familyName = user["family_name"];
    const picture = user["picture"];
    const userId = user["id"];
    const verifiedEmail = user["verified_email"];

    const claims: { typ: string; val: string }[] = [
      {
        typ: "iss",
        val: CUSTOM_AUTH_ISS_MAPPING?.[authProvider],
      },
      {
        typ: "azp",
        val: clientId,
      },
      {
        typ: "aud",
        val: clientId,
      },
    ];

    if (userDetails) {
      claims.push({
        typ: "http://schemas.xmlsoap.org/ws/2005/05/identity/claims/emailaddress",
        val: userDetails,
      });
    }

    if (name) {
      claims.push({
        typ: "name",
        val: name,
      });
    }

    if (picture) {
      claims.push({
        typ: "picture",
        val: picture,
      });
    }

    if (givenName) {
      claims.push({
        typ: "http://schemas.xmlsoap.org/ws/2005/05/identity/claims/givenname",
        val: givenName,
      });
    }

    if (familyName) {
      claims.push({
        typ: "http://schemas.xmlsoap.org/ws/2005/05/identity/claims/surname",
        val: familyName,
      });
    }

    if (userId) {
      claims.push({
        typ: "http://schemas.xmlsoap.org/ws/2005/05/identity/claims/nameidentifier",
        val: userId,
      });
    }

    if (verifiedEmail) {
      claims.push({
        typ: "email_verified",
        val: verifiedEmail,
      });
    }

    if (authProvider === "github") {
      Object.keys(user).forEach((key) => {
        claims.push({
          typ: `urn:github:${key}`,
          val: user[key],
        });
      });
    }

    return {
      identityProvider: authProvider,
      userDetails,
      claims,
      userRoles: ["authenticated", "anonymous"],
    };
  } catch {
    return null;
  }
};

const getOAuthToken = function (authProvider: string, codeValue: string, clientId: string, clientSecret: string, openIdIssuer: string = "") {
  const redirectUri = `${SWA_CLI_APP_PROTOCOL}://${DEFAULT_CONFIG.host}:${DEFAULT_CONFIG.port}`;
  let tenantId;

  if (!Object.keys(CUSTOM_AUTH_TOKEN_ENDPOINT_MAPPING).includes(authProvider)) {
    return null;
  }

  if (authProvider === "aad") {
    tenantId = openIdIssuer.split("/")[3];
  }

  const data = querystring.stringify({
    code: codeValue,
    client_id: clientId,
    client_secret: clientSecret,
    grant_type: "authorization_code",
    redirect_uri: `${redirectUri}/.auth/login/${authProvider}/callback`,
  });

  let tokenPath = CUSTOM_AUTH_TOKEN_ENDPOINT_MAPPING?.[authProvider]?.path;
  if (authProvider === "aad" && tenantId !== undefined) {
    tokenPath = tokenPath.replace("tenantId", tenantId);
  }

  const options = {
    host: CUSTOM_AUTH_TOKEN_ENDPOINT_MAPPING?.[authProvider]?.host,
    path: tokenPath,
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      "Content-Length": Buffer.byteLength(data),
    },
  };

  return new Promise((resolve, reject) => {
    const req = https.request(options, (res) => {
      res.setEncoding("utf8");
      let responseBody = "";

      res.on("data", (chunk) => {
        responseBody += chunk;
      });

      res.on("end", () => {
        resolve(responseBody);
      });
    });

    req.on("error", (err) => {
      reject(err);
    });

    req.write(data);
    req.end();
  });
};

const getOAuthUser = function (authProvider: string, accessToken: string) {
  const options = {
    host: CUSTOM_AUTH_USER_ENDPOINT_MAPPING?.[authProvider]?.host,
    path: CUSTOM_AUTH_USER_ENDPOINT_MAPPING?.[authProvider]?.path,
    method: "GET",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "User-Agent": "Azure Static Web Apps Emulator",
    },
  };

  return new Promise((resolve, reject) => {
    const req = https.request(options, (res) => {
      res.setEncoding("utf8");
      let responseBody = "";

      res.on("data", (chunk) => {
        responseBody += chunk;
      });

      res.on("end", () => {
        try {
          resolve(JSON.parse(responseBody));
        } catch (err) {
          reject(err);
        }
      });
    });

    req.on("error", (err) => {
      reject(err);
    });

    req.end();
  });
};

const getRoles = function (clientPrincipal: RolesSourceFunctionRequestBody, rolesSource: string) {
  let cliApiUri = SWA_CLI_API_URI();
  const { protocol, hostname, port } = parseUrl(cliApiUri);
  const target = hostname === "localhost" ? `${protocol}//127.0.0.1:${port}` : cliApiUri;
  const targetUrl = new URL(target!);

  const data = JSON.stringify(clientPrincipal);

  const options = {
    host: targetUrl.hostname,
    port: targetUrl.port,
    path: rolesSource,
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Content-Length": Buffer.byteLength(data),
    },
  };

  return new Promise((resolve, reject) => {
    const protocolModule = targetUrl.protocol === "https:" ? https : http;

    const req = protocolModule.request(options, (res) => {
      res.setEncoding("utf8");
      let responseBody = "";

      res.on("data", (chunk) => {
        responseBody += chunk;
      });

      res.on("end", () => {
        try {
          resolve(JSON.parse(responseBody));
        } catch (err) {
          reject(err);
        }
      });
    });

    req.on("error", (err) => {
      reject(err);
    });

    req.write(data);
    req.end();
  });
};

const httpTrigger = async function (context: Context, request: http.IncomingMessage, customAuth?: SWAConfigFileAuth) {
  const providerName = normalizeAuthProvider(context.bindingData?.provider);

  if (!SUPPORTED_CUSTOM_AUTH_PROVIDERS.includes(providerName)) {
    context.res = response({
      context,
      status: 400,
      headers: { ["Content-Type"]: "text/plain" },
      body: `Provider '${providerName}' not found`,
    });
    return;
  }

  const { cookie } = request.headers;

  if (!cookie || !validateAuthContextCookie(cookie)) {
    context.res = response({
      context,
      status: 401,
      headers: { ["Content-Type"]: "text/plain" },
      body: "Invalid login request",
    });
    return;
  }

  const url = new URL(request.url!, `${SWA_CLI_APP_PROTOCOL}://${request?.headers?.host}`);

  const codeValue = url.searchParams.get("code");
  const stateValue = url.searchParams.get("state");

  const authContext = decodeAuthContextCookie(cookie);

  if (!authContext?.authNonce || hashStateGuid(authContext.authNonce) !== stateValue) {
    context.res = response({
      context,
      status: 401,
      headers: { ["Content-Type"]: "text/plain" },
      body: "Invalid login request",
    });
    return;
  }

  if (isNonceExpired(authContext.authNonce)) {
    context.res = response({
      context,
      status: 401,
      headers: { ["Content-Type"]: "text/plain" },
      body: "Login timed out. Please try again.",
    });
    return;
  }

  const { clientIdSettingName, clientSecretSettingName, openIdIssuer } =
    customAuth?.identityProviders?.[providerName == "aad" ? ENTRAID_FULL_NAME : providerName]?.registration || {};

  if (!clientIdSettingName) {
    context.res = response({
      context,
      status: 400,
      headers: { ["Content-Type"]: "text/plain" },
      body: `ClientIdSettingName not found for '${providerName}' provider`,
    });
    return;
  }

  if (!clientSecretSettingName) {
    context.res = response({
      context,
      status: 400,
      headers: { ["Content-Type"]: "text/plain" },
      body: `ClientSecretSettingName not found for '${providerName}' provider`,
    });
    return;
  }

  if (providerName == "aad" && !openIdIssuer) {
    context.res = response({
      context,
      status: 400,
      headers: { ["Content-Type"]: "text/plain" },
      body: `openIdIssuer not found for '${providerName}' provider`,
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

  const clientSecret = process.env[clientSecretSettingName];

  if (!clientSecret) {
    context.res = response({
      context,
      status: 400,
      headers: { ["Content-Type"]: "text/plain" },
      body: `ClientSecret not found for '${providerName}' provider`,
    });
    return;
  }

  const clientPrincipal = await getAuthClientPrincipal(providerName, codeValue!, clientId, clientSecret, openIdIssuer!);

  if (clientPrincipal !== null && customAuth?.rolesSource) {
    try {
      const rolesResult = (await getRoles(clientPrincipal as RolesSourceFunctionRequestBody, customAuth.rolesSource)) as { roles: string[] };
      clientPrincipal?.userRoles.push(...rolesResult.roles);
    } catch {}
  }

  const authCookieString = clientPrincipal && JSON.stringify(clientPrincipal);
  const authCookieEncrypted = authCookieString && encryptAndSign(authCookieString);
  const authCookie = authCookieEncrypted ? btoa(authCookieEncrypted) : undefined;

  const cookiesManager = new CookiesManager(request.headers.cookie);
  cookiesManager.addCookieToDelete("StaticWebAppsAuthContextCookie");
  if (authCookie) {
    cookiesManager.addCookieToSet({
      name: "StaticWebAppsAuthCookie",
      value: authCookie,
      domain: DEFAULT_CONFIG.host,
      path: "/",
      secure: true,
      httpOnly: true,
      expires: new Date(Date.now() + 1000 * 60 * 60 * 8).toUTCString(),
    });
  }

  context.res = response({
    context,
    cookies: cookiesManager.getCookies(),
    status: 302,
    headers: {
      status: 302,
      Location: authContext.postLoginRedirectUri ?? "/",
    },
    body: "",
  });
};

export default httpTrigger;

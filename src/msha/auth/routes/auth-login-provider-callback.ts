import * as http from "node:http";
import * as https from "node:https";
import * as querystring from "node:querystring";

import { CookiesManager, decodeAuthContextCookie, validateAuthContextCookie } from "../../../core/utils/cookie.js";
import { parseUrl, response } from "../../../core/utils/net.js";
import { SWA_CLI_API_URI, SWA_CLI_APP_PROTOCOL } from "../../../core/constants.js";
import { DEFAULT_CONFIG } from "../../../config.js";
import { encryptAndSign, hashStateGuid, isNonceExpired } from "../../../core/utils/auth.js";

const getGithubAuthToken = function (codeValue: string, clientId: string, clientSecret: string) {
  const data = querystring.stringify({
    code: codeValue,
    client_id: clientId,
    client_secret: clientSecret,
  });

  const options = {
    host: "github.com",
    path: "/login/oauth/access_token",
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

    req.on("error", (err: Error) => {
      reject(err);
    });

    req.write(data);
    req.end();
  });
};

const getGitHubUser = function (accessToken: string) {
  const options = {
    host: "api.github.com",
    path: "/user",
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

const getGitHubClientPrincipal = async function (codeValue: string, clientId: string, clientSecret: string) {
  let authToken: string;

  try {
    const authTokenResponse = (await getGithubAuthToken(codeValue, clientId, clientSecret)) as string;
    const authTokenParsed = querystring.parse(authTokenResponse);
    authToken = authTokenParsed["access_token"] as string;
  } catch {
    return null;
  }

  if (!authToken) {
    return null;
  }

  try {
    const user = (await getGitHubUser(authToken)) as { [key: string]: string };

    const userId = user["id"];
    const userDetails = user["login"];

    const claims: { typ: string; val: string }[] = [
      {
        typ: "http://schemas.xmlsoap.org/ws/2005/05/identity/claims/nameidentifier",
        val: userId,
      },
    ];

    Object.keys(user).forEach((key) => {
      claims.push({
        typ: `urn:github:${key}`,
        val: user[key],
      });
    });

    return {
      identityProvider: "github",
      userId,
      userDetails,
      userRoles: ["authenticated", "anonymous"],
      claims,
    };
  } catch {
    return null;
  }
};

const getGoogleAuthToken = function (codeValue: string, clientId: string, clientSecret: string) {
  const data = querystring.stringify({
    code: codeValue,
    client_id: clientId,
    client_secret: clientSecret,
    grant_type: "authorization_code",
    redirect_uri: `${SWA_CLI_APP_PROTOCOL}://${DEFAULT_CONFIG.host}:${DEFAULT_CONFIG.port}/.auth/login/google/callback`,
  });

  const options = {
    host: "oauth2.googleapis.com",
    path: "/token",
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

const getGoogleUser = function (accessToken: string) {
  const options = {
    host: "www.googleapis.com",
    path: "/oauth2/v2/userinfo",
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

const getGoogleClientPrincipal = async function (codeValue: string, clientId: string, clientSecret: string) {
  let authToken: string;

  try {
    const authTokenResponse = (await getGoogleAuthToken(codeValue!, clientId, clientSecret)) as string;
    const authTokenParsed = JSON.parse(authTokenResponse);
    authToken = authTokenParsed["access_token"] as string;
  } catch {
    return null;
  }

  if (!authToken) {
    return null;
  }

  try {
    const user = (await getGoogleUser(authToken)) as { [key: string]: string };

    const userId = user["id"];
    const userDetails = user["email"];
    const verifiedEmail = user["verified_email"];
    const name = user["name"];
    const givenName = user["given_name"];
    const familyName = user["family_name"];
    const picture = user["picture"];

    const claims: { typ: string; val: string }[] = [
      {
        typ: "iss",
        val: "https://accounts.google.com",
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

    if (userId) {
      claims.push({
        typ: "http://schemas.xmlsoap.org/ws/2005/05/identity/claims/nameidentifier",
        val: userId,
      });
    }

    if (userDetails) {
      claims.push({
        typ: "http://schemas.xmlsoap.org/ws/2005/05/identity/claims/emailaddress",
        val: userDetails,
      });
    }

    if (verifiedEmail !== undefined) {
      claims.push({
        typ: "email_verified",
        val: verifiedEmail,
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

    return {
      identityProvider: "google",
      userId,
      userDetails,
      claims,
      userRoles: ["authenticated", "anonymous"],
    };
  } catch {
    return null;
  }
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

  const { clientIdSettingName, clientSecretSettingName } = customAuth?.identityProviders?.[providerName]?.registration || {};

  if (!clientIdSettingName) {
    context.res = response({
      context,
      status: 404,
      headers: { ["Content-Type"]: "text/plain" },
      body: `ClientIdSettingName not found for '${providerName}' provider`,
    });
    return;
  }

  if (!clientSecretSettingName) {
    context.res = response({
      context,
      status: 404,
      headers: { ["Content-Type"]: "text/plain" },
      body: `ClientSecretSettingName not found for '${providerName}' provider`,
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

  const clientSecret = process.env[clientSecretSettingName];

  if (!clientSecret) {
    context.res = response({
      context,
      status: 404,
      headers: { ["Content-Type"]: "text/plain" },
      body: `ClientSecret not found for '${providerName}' provider`,
    });
    return;
  }

  const clientPrincipal =
    providerName === "github"
      ? await getGitHubClientPrincipal(codeValue!, clientId, clientSecret)
      : await getGoogleClientPrincipal(codeValue!, clientId, clientSecret);

  if (clientPrincipal !== null && customAuth?.rolesSource) {
    try {
      const rolesResult = (await getRoles(clientPrincipal, customAuth.rolesSource)) as { roles: string[] };
      clientPrincipal.userRoles.push(...rolesResult.roles);
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

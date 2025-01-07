import type http from "node:http";
import { serializeCookie } from "../../core/utils/cookie.js";
import { logger } from "../../core/utils/logger.js";
import { response as newResponse } from "../../core/utils/net.js";
import { SUPPORTED_CUSTOM_AUTH_PROVIDERS } from "../../core/constants.js";

function getAuthPaths(isCustomAuth: boolean): Path[] {
  const paths: Path[] = [];

  if (isCustomAuth) {
    const supportedAuthsRegex = SUPPORTED_CUSTOM_AUTH_PROVIDERS.join("|");

    paths.push({
      method: "GET",
      // only match for providers with custom auth support implemented (github, google, aad, facebook, twitter)
      route: new RegExp(`^/\\.auth/login/(?<provider>${supportedAuthsRegex})/callback(\\?.*)?$`, "i"),
      function: "auth-login-provider-callback",
    });
    paths.push({
      method: "GET",
      // only match for providers with custom auth support implemented (github, google, aad, facebook, twitter)
      route: new RegExp(`^/\\.auth/login/(?<provider>${supportedAuthsRegex})(\\?.*)?$`, "i"),
      function: "auth-login-provider-custom",
    });
    paths.push({
      method: "GET",
      // For providers with custom auth support not implemented, revert to old behavior
      route: /^\/\.auth\/login\/(?<provider>twitter|[a-z]+)(\?.*)?$/i,
      function: "auth-login-provider",
    });
    paths.push({
      method: "POST",
      route: /^\/\.auth\/complete(\?.*)?$/i,
      function: "auth-complete",
    });
  } else {
    paths.push({
      method: "GET",
      route: /^\/\.auth\/login\/(?<provider>github|twitter|google|facebook|[a-z0-9]+)(\?.*)?$/i,
      function: "auth-login-provider",
    });
  }

  paths.push(
    {
      method: "GET",
      route: /^\/\.auth\/me(\?.*)?$/i,
      function: "auth-me",
    },
    {
      method: "GET",
      route: /^\/\.auth\/logout(\?.*)?$/i,
      function: "auth-logout",
    },
    {
      method: "GET",
      route: /^\/\.auth\/purge\/(?<provider>aad|github|twitter|google|facebook|[a-z0-9]+)(\?.*)?$/i,
      // locally, all purge requests are processed as logout requests
      function: "auth-logout",
    },
  );

  return paths;
}

async function routeMatcher(
  url = "/",
  customAuth: SWAConfigFileAuth | undefined,
): Promise<{ func: Function | undefined; bindingData: undefined | { provider: string } }> {
  const authPaths = getAuthPaths(!!customAuth);
  for (let index = 0; index < authPaths.length; index++) {
    const path = authPaths[index];
    const match = url.match(new RegExp(path.route));
    if (match) {
      let bindingData: any;
      if (match.groups?.provider) {
        bindingData = {
          provider: match.groups.provider,
        };
      }

      const func = (await import(`./routes/${path.function}.js`)).default as Function;
      return { func, bindingData };
    }
  }

  return { func: undefined, bindingData: undefined };
}

export async function processAuth(request: http.IncomingMessage, response: http.ServerResponse, rewriteUrl?: string, customAuth?: SWAConfigFileAuth) {
  let defaultStatus = 200;
  const context: Context = {
    invocationId: new Date().getTime().toString(36) + Math.random().toString(36).slice(2),
    bindingData: undefined,
    res: {},
  };

  const { func, bindingData } = await routeMatcher(rewriteUrl || request.url, customAuth);
  if (func) {
    context.bindingData = bindingData;
    try {
      await func(context, request, customAuth);

      for (const key in context.res.headers) {
        const element = context.res.headers[key];
        if (element) {
          response.setHeader(key, element);
        }
      }

      // set auth cookies
      if (context.res.cookies) {
        const serializedCookies = context.res.cookies?.map((cookie) => {
          if (cookie.expires) {
            cookie.expires = new Date(cookie.expires);
          }
          return serializeCookie(cookie.name as string, cookie.value as string, cookie);
        });
        response.setHeader("Set-Cookie", serializedCookies);
      }

      // enable CORS for all requests
      response.setHeader("Access-Control-Allow-Origin", request.headers.origin || "*");
      response.setHeader("Access-Control-Allow-Methods", "GET,OPTIONS");
      response.setHeader("Access-Control-Allow-Credentials", "true");

      // set JSON response by default (if no content type was set)
      if (response.hasHeader("Content-Type") === false) {
        response.setHeader("Content-Type", "application/json");
      }

      // if response type is JSON, serialize body response
      if (response.getHeader("Content-Type")?.toString().includes("json") && typeof context.res.body === "object") {
        context.res.body = JSON.stringify(context.res.body) as string;
      }
    } catch (error) {
      let errorMessage = `An error occurred while processing the request!`;
      if (error instanceof Error) {
        errorMessage = error.message;
      }

      logger.error(errorMessage);

      defaultStatus = 500;
      context.res = newResponse({
        context,
        status: 500,
        body: {
          error: errorMessage,
        },
      });
    }
  } else {
    defaultStatus = 404;
    context.res = newResponse({
      context,
      status: 404,
      headers: { ["Content-Type"]: "text/plain" },
      body: "We couldn't find that page, please check the URL and try again.",
    });
  }

  const statusCode = context.res.status || defaultStatus;

  response.writeHead(statusCode);
  response.end(context.res.body);

  return statusCode;
}

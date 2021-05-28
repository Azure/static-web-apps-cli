import type http from "http";
import { response } from "../../core";
import { SWA_CLI_APP_PROTOCOL } from "../../core/utils/constants";

export default async function (context: Context, req: http.IncomingMessage) {
  const headers = req?.headers;
  const host = headers ? headers["x-forwarded-host"] || headers.host : undefined;
  if (!host) {
    context.res = response({
      context,
      status: 500,
    });
    return;
  }


  const uri = `${headers["x-forwarded-proto"] || SWA_CLI_APP_PROTOCOL}://${host}`;
  const query = new URL(req?.url || "", uri).searchParams;
  const location = `${uri}${query.get("post_logout_redirect_uri") || "/"}`;

  context.res = response({
    context,
    status: 302,
    cookies: [
      {
        name: "StaticWebAppsAuthCookie",
        value: "deleted",
        path: "/",
        HttpOnly: false,
        expires: new Date(1).toUTCString(),
      },
    ],
    headers: {
      Location: location,
    },
  });
}

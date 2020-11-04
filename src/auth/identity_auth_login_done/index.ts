import { AzureFunction, HttpRequest } from "@azure/functions";
import { response } from "../../utils";
import jwt from "jsonwebtoken";
const SWA_EMU_AUTH_URI = process.env.SWA_EMU_AUTH_URI || `http://localhost:4242`;
import { currentUser } from "../../userManager";

const jwtKey = "123";
const jwtExpirySeconds = 300;

const httpTrigger: AzureFunction = async function (context, req: HttpRequest) {
  const { cookie } = req.headers;
  const payload = {
    ...currentUser(cookie),
    nonce: context.invocationId,
    iss: "localhost",
    aud: "localhost",
  };
  const user_login_jwt = jwt.sign(payload, jwtKey, {
    algorithm: "HS256",
    expiresIn: jwtExpirySeconds,
  });
  // This doesn't match the API, but we need to get the redir value across
  const { post_login_redirect_uri = "" } = req.query;

  context.res = response({
    context,
    status: 200,
    cookies: [
      {
        name: "StaticWebAppsAuthContextCookie",
        value: "deleted",
        path: "/",
        domain: "localhost",
      },
    ],
    headers: {
      "Content-Type": "text/html",
      status: 200,
    },
    body: `
    <title>Working...</title>
    <form id="f" method="POST" action="${SWA_EMU_AUTH_URI}/app/.auth/complete?post_login_redirect_uri=${post_login_redirect_uri}">
      <input type="hidden" name="user_login_jwt" value="${user_login_jwt}" />
      <noscript>
        <p>Script is disabled.Click Submit to continue.</p>
        <input type="submit" value="Submit" />
        </noscript>
      </form>
      <script>f.submit();</script>`,
  });
};

export default httpTrigger;

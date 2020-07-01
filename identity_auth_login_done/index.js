const { response } = require("../src/utils");
const jwt = require("jsonwebtoken");

const jwtKey = "123";
const jwtExpirySeconds = 300;

module.exports = async function (context, req) {
  const payload = {
    ...{
      identityprovider: "github",
      useridfromprovider: "1699357",
      userid: "59cd31faa8c34919ac22c19af50482b8",
      userdetails: "manekinekko",
      isnewuser: "False",
      existingroles: "",
    },
    nonce: context.invocationId,
    iss: "https://localhost/",
    aud: "https://localhost/",
  };
  const user_login_jwt = jwt.sign(payload, jwtKey, {
    algorithm: "HS256",
    expiresIn: jwtExpirySeconds,
  });

  context.res = response({
    context,
    status: 200,
    cookies: [
      {
        name: "StaticWebAppsAuthContextCookie",
        value: "deleted",
        path: "/",
        domain: "localhost",
      }
    ],
    headers: {
      "Content-Type": "text/html",
      status: 200,
    },
    body: `
    <title>Working...</title>
    <form id="f" method="POST" action="http://localhost:4242/app/.auth/complete">
      <input type="hidden" name="user_login_jwt" value="${user_login_jwt}" />
      <noscript>
        <p>Script is disabled.Click Submit to continue.</p>
        <input type="submit" value="Submit" />
        </noscript>
      </form>
      <script>f.submit();</script>`,
  });
};

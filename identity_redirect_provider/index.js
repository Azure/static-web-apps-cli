const { response } = require("../utils");

module.exports = async function (context, req) {
  const { provider } = context.bindingData;
  const { hostName, post_login_redirect_uri = "/.auth/login/done" } = req.query;

  const location = `http://localhost:4242/.auth/login/${provider}?post_login_redirect_uri=${post_login_redirect_uri}`;

  context.res = response({
    context,
    status: 302,
    cookies: [
      {
        name: "StaticWebAppsAuthContextCookie",
        value: "xxx",
        path: "/",
        secure: true,
        HttpOnly: true,
        domain: hostName,
        SameSite: "None",
      },
    ],
    headers: {
      location,
    },
  });
};

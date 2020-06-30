const { response } = require("../utils");

module.exports = async function (context, req) {
  const { provider } = context.bindingData;
  const { hostName, post_login_redirect_uri = "/.auth/login/done" } = req.query;

  const location = `http://127.0.0.1:4242/.auth/login/${provider}?post_login_redirect_uri=${post_login_redirect_uri}`;

  context.res = response({
    context,
    status: 302,
    cookies: [
      {
        name: "StaticWebAppsAuthContextCookie",
        value: process.env.StaticWebAppsAuthContextCookie,
        path: "/",
        secure: false,
        HttpOnly: false,
        domain: hostName,
        SameSite: "None",
      },
    ],
    headers: {
      location,
    },
  });
};

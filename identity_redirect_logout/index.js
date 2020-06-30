const { response } = require("../utils");

module.exports = async function (context, req) {
  const { hostName, post_logout_redirect_uri = "/" } = req.query;

  const location = `//localhost:4242/.auth/logout?post_login_redirect_uri=${post_logout_redirect_uri}`;

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
        domain: "localhost",
        SameSite: "None",
      },
    ],
    headers: {
      location,
    },
  });
};

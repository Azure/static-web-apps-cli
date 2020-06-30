const { response } = require("../utils");

module.exports = async function (context, req) {
  const { provider } = context.bindingData;
  const { post_login_redirect_uri } = req.query;

  const location = `//127.0.0.1:4200/profile`;
  context.res = response({
    context,
    status: 302,
    cookies: [
      {
        name: "StaticWebAppsAuthContextCookie",
        value: "deleted",
        path: "/",
        domain: "127.0.0.1",
        expires: new Date(1970),
      },
      {
        name: "StaticWebAppsAuthCookie",
        value: process.env.StaticWebAppsAuthCookie,
        path: "/",
        secure: false,
        HttpOnly: false,
        domain: "127.0.0.1",
        SameSite: "Strict",
      },
    ],
    headers: {
      location,
    },
  });
};

const { response } = require("../utils");

module.exports = async function (context, req) {
  const { provider } = context.bindingData;
  const { post_login_redirect_uri } = req.query;

  const location = `http://localhost:4200/profile`;
  context.res = response({
    context,
    status: 302,
    cookies: [
      {
        name: "StaticWebAppsAuthContextCookie",
        value: "deleted",
        path: "/",
        domain: "localhost",
        expires: new Date("Thu, 01 Jan 1970 00:00:00 GMT"),
      },
      {
        name: "StaticWebAppsAuthCookie",
        value: "xxx",
        path: "/",
        secure: true,
        HttpOnly: true,
        domain: "localhost",
        SameSite: "Strict",
      },
    ],
    headers: {
      location,
    },
  });
};

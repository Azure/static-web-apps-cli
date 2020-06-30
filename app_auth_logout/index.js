const { response, validateCookie } = require("../utils");

module.exports = async function (context, req) {
  const cookie = req.headers.cookie;
  const { post_logout_redirect_uri } = req.query;

  if (!cookie || !validateCookie(cookie)) {
    return response({
      context,
      status: 401,
    });
  }

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
      location: `//localhost:4242/.redirect/logout?hostName=localhost`,
    },
  });
};

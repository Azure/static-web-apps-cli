const { response } = require("../utils");

module.exports = async function (context, req) {
  const location = `//localhost:4242/app/.auth/logout/complete`;

  context.res = response({
    context,
    status: 302,
    cookies: [
      {
        name: "StaticWebAppsAuthContextCookie",
        value: "deleted",
        path: "/",
        secure: false,
        HttpOnly: false,
        domain: "localhost",
        expires: new Date(1970),
      },
    ],
    headers: {
      location,
    },
  });
};

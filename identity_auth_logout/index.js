const { response } = require("../utils");

module.exports = async function (context, req) {
  context.res = response({
    context,
    status: 302,
    cookies: [
      {
        name: "AppServiceAuthSession",
        value: "deleted",
        path: "/",
        secure: false,
        HttpOnly: false,
        expires: new Date(1970),
      },
    ],
    headers: {
      location: `http://127.0.0.1:4242/.auth/logout/complete`,
    },
  });
};

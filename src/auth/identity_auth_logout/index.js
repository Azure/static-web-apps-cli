const { response } = require("../../utils");
const SWA_EMU_AUTH_URI = process.env.SWA_EMU_AUTH_URI || `http://localhost:4242`;

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
      location: `${SWA_EMU_AUTH_URI}/.auth/logout/complete`,
    },
  });
};

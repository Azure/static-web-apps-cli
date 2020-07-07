const { response, ɵɵUseGithubDevToken } = require("../../utils");
const SWA_EMU_AUTH_URI = process.env.SWA_EMU_AUTH_URI || `http://localhost:4242`;

module.exports = async function (context, req) {
  const { provider } = context.bindingData;
  const { post_login_redirect_uri } = req.query;

  const redirect_uri = `${SWA_EMU_AUTH_URI}/.auth/login/${provider}/callback&state=${encodeURIComponent(`redir=${post_login_redirect_uri}&nonce=${context.invocationId}`)}`;

  let client_id = process.env.GITHUB_CLIENT_ID;

  //**** GITHUB NOTICE */
  if (!client_id) {
    ({ client_id } = await ɵɵUseGithubDevToken());
  }
  //**** GITHUB NOTICE */

  const location = `https://github.com/login/oauth/authorize?client_id=${client_id}&redirect_uri=${redirect_uri}`;

  context.res = response({
    context,
    status: 302,
    cookies: [
      {
        name: "Nonce",
        value: context.invocationId,
        path: "/",
        secure: false,
        HttpOnly: false,
        SameSite: "None",
      },
    ],
    headers: {
      location,
    },
  });
};

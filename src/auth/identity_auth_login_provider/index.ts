const { response, ɵɵUseGithubDevToken } = require("../../utils");
const SWA_EMU_AUTH_URI = process.env.SWA_EMU_AUTH_URI || `http://localhost:4242`;

module.exports = async function (context, req) {
  const { provider } = context.bindingData;
  const { post_login_redirect_uri } = req.query;

  const redirect_uri = `${SWA_EMU_AUTH_URI}/.auth/login/${provider}/callback&state=${encodeURIComponent(
    `redir=${post_login_redirect_uri}&nonce=${context.invocationId}`
  )}`;
  let location = "";
  let client_id = "fake-client-id";

  switch (provider) {
    case "github":
      client_id = process.env.GITHUB_CLIENT_ID;

      //**** GITHUB NOTICE: start */
      if (!client_id) {
        ({ client_id } = await ɵɵUseGithubDevToken());
      }
      //**** GITHUB NOTICE: end */
      location = `https://github.com/login/oauth/authorize?client_id=${client_id}&redirect_uri=${redirect_uri}`;

      break;

    case "twitter":
    case "google":
    case "facebook":
    case "aad":
      location = `${SWA_EMU_AUTH_URI}/fake/${provider}/oauth/authorize?client_id=${client_id}&redirect_uri=${redirect_uri}`;
      break;
    default:
    // TODO: throw http error
  }

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

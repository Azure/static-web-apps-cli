const { response } = require("../utils");

module.exports = async function (context, req) {
  const { provider } = context.bindingData;
  const { post_login_redirect_uri } = req.query;

  const redirect_uri = `http://localhost:4242/.auth/login/${provider}/callback&state=${encodeURIComponent(
    `redir=${post_login_redirect_uri}&nonce=${context.invocationId}`
  )}`;

  const client_id = process.env.GITHUB_CLIENT_ID;
  const location = `https://github.com/login/oauth/authorize?client_id=${client_id}&redirect_uri=${redirect_uri}`;
  context.res = response({
    context,
    status: 302,
    headers: {
      "set-cookie": `Nonce=zzz; path=/; secure; HttpOnly; SameSite=None`,
      location,
    },
  });
};

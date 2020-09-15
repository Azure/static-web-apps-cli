const { response, ɵɵUseGithubDevToken } = require("../../utils");
const SWA_EMU_AUTH_URI = process.env.SWA_EMU_AUTH_URI || `http://localhost:4242`;

module.exports = async function (context, req) {
  const { provider } = context.bindingData;
  const { redirect_uri, state, client_id } = req.query;

  console.log("+++++++++");
  console.log(req.query);
  console.log("+++++++++");

  location = `${redirect_uri}?code=CODE&state=${state}`;

  context.res = response({
    context,
    status: 302,
    headers: {
      location,
    },
  });
};

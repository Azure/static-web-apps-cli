
import { response } from "../../utils";
const SWA_EMU_AUTH_URI = process.env.SWA_EMU_AUTH_URI || `http://localhost:4242`;

const httpTrigger = async function (context: Context, req: ServerRequest) {
  const { post_logout_redirect_uri } = req.query;
  context.res = response({
    context,
    status: 302,
    cookies: [
      {
        name: "AppServiceAuthSession",
        value: "deleted",
        path: "/",
        // secure: false,
        HttpOnly: false,
        expires: new Date(1).toUTCString(),
      },
    ],
    headers: {
      location: `${SWA_EMU_AUTH_URI}/.auth/logout/complete?post_logout_redirect_uri=${post_logout_redirect_uri}`,
    },
  });
};

export default httpTrigger;

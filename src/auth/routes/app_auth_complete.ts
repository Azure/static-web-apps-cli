
import { response } from "../../utils";
const SWA_EMU_HOST = "http://localhost:" + process.env.SWA_EMU_PORT;

const httpTrigger = async function (context: Context, req: ServerRequest) {
  const { post_login_redirect_uri = "" } = req.query;

  context.res = response({
    context,
    status: 200,
    cookies: [
      {
        name: "StaticWebAppsAuthContextCookie",
        value: "deleted",
        path: "/",
        domain: "localhost",
        expires: new Date(1).toUTCString(),
      },
      {
        name: "StaticWebAppsAuthCookie",
        value: process.env.StaticWebAppsAuthCookie,
        path: "/",
        // secure: false,
        HttpOnly: false,
        domain: "localhost",
        SameSite: "Strict",
      },
    ],
    headers: {
      "Content-Type": "text/html",
      status: 200,
    },
    body: `
    <html>
    <head>
      <title>Working...</title>
    </head>
    <body>
      <form
        method="GET"
        name="hiddenform"
        action="${SWA_EMU_HOST}${post_login_redirect_uri}"
      >
        <noscript
          ><p>Script is disabled. Click Submit to continue.</p>
          <input type="submit" value="Submit"
        /></noscript>
      </form>
      <script language="javascript">
        document.forms[0].submit();
      </script>
    </body>
  </html>
    `,
  });
};

export default httpTrigger;

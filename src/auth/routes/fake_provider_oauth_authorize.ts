
import { response } from "../../utils";

const httpTrigger = async function (context: Context, req: ServerRequest) {
  const { redirect_uri, state } = req.query;

  console.log("+++++++++");
  console.log(req.query);
  console.log("+++++++++");

  const location = `${redirect_uri}?code=CODE&state=${state}`;

  context.res = response({
    context,
    status: 302,
    headers: {
      location,
    },
  });
};

export default httpTrigger;

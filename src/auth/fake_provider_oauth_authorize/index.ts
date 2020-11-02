import { AzureFunction, HttpRequest } from "@azure/functions";
import { response } from "../../utils";

const httpTrigger: AzureFunction = async function (context, req: HttpRequest) {
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

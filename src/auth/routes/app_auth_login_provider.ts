import { response } from "../../core/utils";

const fs = require("fs").promises;
const path = require("path");

const httpTrigger = async function (context: Context) {
  const body = await fs.readFile(path.join(__dirname, "..", "..", "public", "index.html"));

  context.res = response({
    context,
    status: 200,
    headers: {
      "Content-Type": "text/html",
      status: 200,
    },
    body,
  });
};

export default httpTrigger;

module.exports = async function (context, req) {
    context.res = {
        status: req.query.statuscode || "200",
        body: "/api/status"
    };
}
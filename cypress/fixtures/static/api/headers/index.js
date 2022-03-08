module.exports = async function (context, req) {
    req.headers['x-swa-custom'] = "/api/headers"
    context.res.json(req.headers)
}
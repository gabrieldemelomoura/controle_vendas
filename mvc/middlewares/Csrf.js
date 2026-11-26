const crypto = require("node:crypto");

function fornecerTokenCsrf(req, res, next) {
    if (!req.session.csrfToken) {
        req.session.csrfToken = crypto.randomBytes(32).toString("hex");
    }
    res.locals.csrfToken = req.session.csrfToken;
    return next();
}

function validarTokenCsrf(req, res, next) {
    const esperado = req.session?.csrfToken;
    const recebido = req.body?._csrf;

    if (typeof esperado !== "string" || typeof recebido !== "string") {
        return res.status(403).send("A solicitação expirou. Atualize a página e tente novamente.");
    }

    const esperadoBuffer = Buffer.from(esperado);
    const recebidoBuffer = Buffer.from(recebido);
    if (esperadoBuffer.length !== recebidoBuffer.length ||
        !crypto.timingSafeEqual(esperadoBuffer, recebidoBuffer)) {
        return res.status(403).send("A solicitação expirou. Atualize a página e tente novamente.");
    }

    return next();
}

module.exports = { fornecerTokenCsrf, validarTokenCsrf };

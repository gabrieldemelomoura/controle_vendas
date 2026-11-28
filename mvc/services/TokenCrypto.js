const crypto = require("node:crypto");

function carregarChave(valor = process.env.TOKEN_ENCRYPTION_KEY) {
    if (typeof valor !== "string" || !/^[a-f0-9]{64}$/i.test(valor)) {
        throw new Error("TOKEN_ENCRYPTION_KEY deve conter 64 caracteres hexadecimais (32 bytes). Gere uma chave nova e guarde-a fora do Git.");
    }
    return Buffer.from(valor, "hex");
}

function criptografarToken(token, chave = carregarChave()) {
    if (typeof token !== "string" || !token) throw new TypeError("O token precisa ser uma string não vazia.");
    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv("aes-256-gcm", chave, iv);
    const conteudo = Buffer.concat([cipher.update(token, "utf8"), cipher.final()]);
    return JSON.stringify({
        versao: 1,
        iv: iv.toString("hex"),
        tag: cipher.getAuthTag().toString("hex"),
        dados: conteudo.toString("hex"),
    });
}

function descriptografarToken(valor, chave = carregarChave()) {
    const registro = JSON.parse(valor);
    if (registro?.versao !== 1 || !/^[a-f0-9]{24}$/i.test(registro.iv || "") ||
        !/^[a-f0-9]{32}$/i.test(registro.tag || "") || !/^(?:[a-f0-9]{2})+$/i.test(registro.dados || "")) {
        throw new Error("Formato de token criptografado inválido.");
    }
    const decipher = crypto.createDecipheriv("aes-256-gcm", chave, Buffer.from(registro.iv, "hex"));
    decipher.setAuthTag(Buffer.from(registro.tag, "hex"));
    return Buffer.concat([
        decipher.update(Buffer.from(registro.dados, "hex")),
        decipher.final(),
    ]).toString("utf8");
}

module.exports = { carregarChave, criptografarToken, descriptografarToken };

const conexaoPadrao = require("../model/BancoModel");

function criarMiddlewaresAutenticacao(conexao = conexaoPadrao) {
    async function exigirLogin(req, res, next) {
        const sessaoUsuario = req.session?.usuario;
        if (!sessaoUsuario?.id) return res.redirect("/login");

        try {
            const [usuarios] = await conexao.execute(
                `SELECT id, nome, perfil, ativo, versao_sessao FROM usuarios WHERE id = ? LIMIT 1`,
                [sessaoUsuario.id]
            );
            const usuario = usuarios[0];
            if (!usuario || Number(usuario.ativo) !== 1 ||
                Number(sessaoUsuario.versaoSenha) !== Number(usuario.versao_sessao)) {
                return req.session.destroy(() => {
                    res.clearCookie("connect.sid");
                    res.redirect("/login");
                });
            }

            req.session.usuario.nome = usuario.nome;
            req.session.usuario.perfil = usuario.perfil;
            req.session.usuario.versaoSenha = Number(usuario.versao_sessao);
            return next();
        } catch (erro) {
            return next(erro);
        }
    }

    function exigirAdmin(req, res, next) {
        if (!req.session?.usuario) return res.redirect("/login");
        if (req.session.usuario.perfil !== "admin") {
            return res.status(403).send("Acesso permitido somente a administradores.");
        }
        return next();
    }

    return { exigirLogin, exigirAdmin };
}

module.exports = { ...criarMiddlewaresAutenticacao(), criarMiddlewaresAutenticacao };

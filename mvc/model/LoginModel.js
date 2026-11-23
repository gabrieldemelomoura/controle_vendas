const conexao = require("./BancoModel");

class LoginModel {
    async buscarPorUsuario(usuario) {
        const [usuarios] = await conexao.execute(
        "SELECT id, nome, usuario, senha_hash FROM usuarios WHERE usuario = ? LIMIT 1",
        [usuario]
        );

        return usuarios[0] || null;
    }
}

module.exports = LoginModel;
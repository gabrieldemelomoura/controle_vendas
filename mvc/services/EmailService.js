const nodemailer = require("nodemailer");

class EmailService {
    constructor({ transporter } = {}) {
        this.transporter = transporter || this.criarTransporter();
        this.remetente = process.env.MAIL_FROM || process.env.SMTP_USER;
    }

    criarTransporter() {
        const { SMTP_HOST, SMTP_USER, SMTP_PASS } = process.env;
        if (!SMTP_HOST || !SMTP_USER || !SMTP_PASS) return null;

        const port = Number(process.env.SMTP_PORT || 587);
        return nodemailer.createTransport({
            host: SMTP_HOST,
            port,
            secure: process.env.SMTP_SECURE
                ? process.env.SMTP_SECURE.toLowerCase() === "true"
                : port === 465,
            auth: { user: SMTP_USER, pass: SMTP_PASS },
            disableFileAccess: true,
            disableUrlAccess: true,
        });
    }

    async enviarLinkRedefinicao(destinatario, url) {
        if (!this.transporter || !this.remetente) {
            const erro = new Error("Configure SMTP_HOST, SMTP_USER, SMTP_PASS e MAIL_FROM para enviar e-mails.");
            erro.code = "SMTP_NOT_CONFIGURED";
            throw erro;
        }

        await this.transporter.sendMail({
            from: this.remetente,
            to: destinatario,
            subject: "Redefinição de senha | Martins Importadora",
            text: `Recebemos uma solicitação para redefinir sua senha. Acesse este link, válido por 30 minutos: ${url}\n\nSe você não solicitou, ignore este e-mail.`,
            html: `<div style="font-family:Arial,sans-serif;max-width:560px;margin:auto;color:#252525"><div style="background:#252525;padding:24px;color:#fff"><strong style="font-size:20px;letter-spacing:2px">MARTINS</strong><div style="color:#bbb;font-size:11px;letter-spacing:3px">IMPORTADORA</div></div><div style="padding:28px;border:1px solid #eee"><h1 style="font-size:22px">Redefina sua senha</h1><p>Recebemos uma solicitação para alterar a senha da sua conta.</p><p style="margin:28px 0"><a href="${url}" style="background:#F15A24;color:#fff;padding:14px 20px;border-radius:8px;text-decoration:none;font-weight:bold">Criar nova senha</a></p><p style="color:#777;font-size:13px">O link expira em 30 minutos e só pode ser usado uma vez. Se você não solicitou a alteração, ignore este e-mail.</p></div></div>`,
        });
    }
}

module.exports = EmailService;

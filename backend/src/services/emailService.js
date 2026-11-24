const fs = require('node:fs');
const path = require('node:path');
const nodemailer = require('nodemailer');

const RUTA_LOGO_BLANCO = path.resolve(__dirname, '../assets/logo-ulatina-blanco.png');
const CID_LOGO_BLANCO = 'logo-ulatina-blanco';

const escaparHtml = (texto) =>
  String(texto ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

const smtpConfigurado = () =>
  Boolean(
    process.env.SMTP_HOST?.trim() &&
      process.env.SMTP_USER?.trim() &&
      process.env.SMTP_PASS?.trim()
  );

const crearTransportador = () => {
  const puerto = Number(process.env.SMTP_PORT) || 587;
  const seguro =
    String(process.env.SMTP_SECURE || '')
      .trim()
      .toLowerCase() === 'true' || puerto === 465;

  return nodemailer.createTransport({
    host: process.env.SMTP_HOST.trim(),
    port: puerto,
    secure: seguro,
    auth: {
      user: process.env.SMTP_USER.trim(),
      pass: process.env.SMTP_PASS,
    },
  });
};

const construirCorreoRecuperacion = ({
  nombre,
  enlace,
  minutosExpiracion,
  incluirLogo = false,
}) => {
  const nombreSeguro = escaparHtml(nombre || 'Usuario');
  const enlaceSeguro = escaparHtml(enlace);
  const minutos = Number(minutosExpiracion) || 30;

  const subject = 'Recuperación de contraseña — Inventario Tecnológico ULatina';

  const text = [
    `Hola ${nombre || 'Usuario'},`,
    '',
    'Recibimos una solicitud para restablecer la contraseña de su cuenta en el Sistema de Gestión de Inventario Tecnológico de la Universidad Latina de Costa Rica.',
    '',
    `Abra el siguiente enlace para crear una nueva contraseña (válido por ${minutos} minutos y de un solo uso):`,
    enlace,
    '',
    'Si usted no realizó esta solicitud, puede ignorar este mensaje y su contraseña actual seguirá intacta.',
  ].join('\n');

  const bloqueLogo = incluirLogo
    ? `
                  <tr>
                    <td align="left" style="padding: 0 0 18px 0;">
                      <img src="cid:${CID_LOGO_BLANCO}" alt="Universidad Latina de Costa Rica" width="170" style="display: block; width: 170px; max-width: 100%; height: auto; border: 0; outline: none; text-decoration: none;" />
                    </td>
                  </tr>`
    : '';

  const html = `<!DOCTYPE html>
<html lang="es">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${escaparHtml(subject)}</title>
  </head>
  <body style="margin: 0; padding: 0; background-color: #f1f5f9; font-family: Arial, Helvetica, sans-serif; color: #1e293b; -webkit-text-size-adjust: 100%;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="width: 100%; background-color: #f1f5f9; margin: 0; padding: 0;">
      <tr>
        <td align="center" style="padding: 32px 16px;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="width: 100%; max-width: 580px; background-color: #ffffff; border: 1px solid #e2e8f0; border-radius: 14px; overflow: hidden; box-shadow: 0 12px 28px rgba(7, 86, 64, 0.10);">
            <!-- Encabezado institucional -->
            <tr>
              <td style="background-color: #075640; padding: 28px 32px 24px 32px;">
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">${bloqueLogo}
                  <tr>
                    <td style="padding: 0;">
                      <h1 style="margin: 0; color: #ffffff; font-size: 20px; line-height: 1.3; font-weight: 700;">
                        Sistema de Gestión de Inventario Tecnológico
                      </h1>
                      <p style="margin: 6px 0 0 0; color: #d1fae5; font-size: 13px; line-height: 1.45;">
                        Universidad Latina de Costa Rica · Facultad de Ingenierías y TICs
                      </p>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>

            <!-- Línea de acento lima -->
            <tr>
              <td style="height: 4px; line-height: 4px; font-size: 0; background-color: #b3d334;">&nbsp;</td>
            </tr>

            <!-- Cuerpo principal -->
            <tr>
              <td style="padding: 30px 32px 24px 32px; background-color: #ffffff;">
                <p style="margin: 0 0 14px 0; font-size: 15px; line-height: 1.5; color: #0f172a;">
                  Hola <strong>${nombreSeguro}</strong>,
                </p>
                <p style="margin: 0 0 22px 0; font-size: 14px; line-height: 1.65; color: #334155;">
                  Recibimos una solicitud para restablecer la contraseña de su cuenta institucional. Haga clic en el siguiente botón para crear una nueva contraseña:
                </p>

                <!-- Botón principal -->
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin: 0 0 24px 0;">
                  <tr>
                    <td align="center">
                      <table role="presentation" cellpadding="0" cellspacing="0" border="0">
                        <tr>
                          <td align="center" bgcolor="#057a55" style="border-radius: 9px; background-color: #057a55;">
                            <a href="${enlaceSeguro}" target="_blank" rel="noopener noreferrer" style="display: inline-block; padding: 14px 28px; font-family: Arial, Helvetica, sans-serif; font-size: 15px; font-weight: 700; color: #ffffff; text-decoration: none; border-radius: 9px;">
                              Restablecer contraseña
                            </a>
                          </td>
                        </tr>
                      </table>
                    </td>
                  </tr>
                </table>

                <!-- Caja de aviso de vigencia y un solo uso -->
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin: 0 0 20px 0; background-color: #ecfdf5; border: 1px solid #bbf7d0; border-left: 4px solid #057a55; border-radius: 8px;">
                  <tr>
                    <td style="padding: 13px 16px; font-size: 13px; line-height: 1.55; color: #064e3b;">
                      <strong>Importante:</strong> este enlace vencerá en <strong>${minutos} minutos</strong> y es de <strong>un solo uso</strong>. Por su seguridad, no lo comparta con nadie.
                    </td>
                  </tr>
                </table>

                <!-- Bloque gris suave para enlace alternativo -->
                <p style="margin: 0 0 8px 0; font-size: 12.5px; color: #475569; line-height: 1.5;">
                  Si el botón no funciona, copie y pegue el siguiente enlace en su navegador:
                </p>
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin: 0 0 18px 0; background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px;">
                  <tr>
                    <td style="padding: 12px 14px; font-size: 12px; line-height: 1.5; color: #075640; word-break: break-all;">
                      <a href="${enlaceSeguro}" target="_blank" rel="noopener noreferrer" style="color: #075640; text-decoration: underline; word-break: break-all;">${enlaceSeguro}</a>
                    </td>
                  </tr>
                </table>

                <p style="margin: 0; font-size: 12.5px; line-height: 1.55; color: #64748b;">
                  Si usted no solicitó este cambio, puede ignorar este correo de forma segura; su contraseña actual permanecerá intacta.
                </p>
              </td>
            </tr>

            <!-- Pie institucional -->
            <tr>
              <td style="background-color: #f8fafc; border-top: 1px solid #e2e8f0; padding: 16px 32px; text-align: center;">
                <p style="margin: 0; font-size: 12px; line-height: 1.5; color: #64748b;">
                  <strong>Universidad Latina de Costa Rica</strong> · Laboratorios de Ingeniería en Sistemas<br />
                  Mensaje automático de seguridad. Por favor, no responda a este correo.
                </p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;

  return { subject, text, html };
};

const enviarCorreoRecuperacion = async (
  { para, nombre, enlace, minutosExpiracion },
  transportadorOpcional = null
) => {
  let transportador = transportadorOpcional;

  if (!transportador) {
    if (!smtpConfigurado()) {
      const error = new Error(
        'Servicio SMTP no configurado. Defina SMTP_HOST, SMTP_USER y SMTP_PASS en backend/.env.'
      );
      error.code = 'SMTP_NO_CONFIGURADO';
      throw error;
    }
    transportador = crearTransportador();
  }

  const remitente =
    process.env.SMTP_FROM?.trim() ||
    process.env.SMTP_USER?.trim() ||
    'no-reply@ulatina.cr';

  const tieneLogo = fs.existsSync(RUTA_LOGO_BLANCO);

  const contenido = construirCorreoRecuperacion({
    nombre,
    enlace,
    minutosExpiracion,
    incluirLogo: tieneLogo,
  });

  const opcionesMensaje = {
    from: remitente,
    to: para,
    subject: contenido.subject,
    text: contenido.text,
    html: contenido.html,
  };

  if (tieneLogo) {
    opcionesMensaje.attachments = [
      {
        filename: 'logo-ulatina-blanco.png',
        path: RUTA_LOGO_BLANCO,
        cid: CID_LOGO_BLANCO,
        contentDisposition: 'inline',
      },
    ];
  }

  await transportador.sendMail(opcionesMensaje);
};

module.exports = {
  RUTA_LOGO_BLANCO,
  CID_LOGO_BLANCO,
  smtpConfigurado,
  crearTransportador,
  construirCorreoRecuperacion,
  enviarCorreoRecuperacion,
};

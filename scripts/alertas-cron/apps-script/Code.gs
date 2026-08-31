// Web App de Apps Script: recibe {to, subject, html, token} por POST y manda
// el correo desde la cuenta de Gmail dueña de este script (MailApp).
// Deployalo como "Web app" (Execute as: Me, Access: Anyone) y usá la URL
// /exec resultante como APPSCRIPT_URL en los secrets de GitHub.

// Abrí la URL /exec directo en el navegador para confirmar que el deployment
// es alcanzable públicamente (sin necesitar el token ni mandar POST).
function doGet(e) {
  return ContentService.createTextOutput('OK — el Web App está desplegado y es accesible.')
}

function doPost(e) {
  const respond = (obj) =>
    ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON)

  let body
  try {
    body = JSON.parse(e.postData.contents)
  } catch (err) {
    return respond({ ok: false, error: 'JSON inválido' })
  }

  const secret = PropertiesService.getScriptProperties().getProperty('SHARED_SECRET')
  if (!secret || body.token !== secret) {
    return respond({ ok: false, error: 'unauthorized' })
  }

  if (!body.to || !body.subject || !body.html) {
    return respond({ ok: false, error: 'faltan campos (to/subject/html)' })
  }

  try {
    MailApp.sendEmail({
      to: body.to,
      subject: body.subject,
      htmlBody: body.html,
    })
    return respond({ ok: true })
  } catch (err) {
    return respond({ ok: false, error: String(err) })
  }
}

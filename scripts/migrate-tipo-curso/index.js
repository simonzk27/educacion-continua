// Migración one-off: renombra el tipo de curso "Natural" a "Educación Continua"
// en la colección `cursos`.
//
// Uso:
//   FIREBASE_SERVICE_ACCOUNT='<json de la service account>' node index.js
//   FIREBASE_SERVICE_ACCOUNT='<json>' node index.js --dry-run

const admin = require('firebase-admin')

const VALOR_VIEJO = 'Natural'
const VALOR_NUEVO = 'Educación Continua'

function initAdmin() {
  const serviceAccountJson = process.env.FIREBASE_SERVICE_ACCOUNT
  if (!serviceAccountJson) {
    console.error('Falta la variable de entorno FIREBASE_SERVICE_ACCOUNT (JSON de la service account).')
    process.exit(1)
  }
  const serviceAccount = JSON.parse(serviceAccountJson)
  admin.initializeApp({ credential: admin.credential.cert(serviceAccount) })
}

async function main() {
  const dryRun = process.argv.includes('--dry-run')
  initAdmin()
  const db = admin.firestore()

  const snap = await db.collection('cursos').where('tipo', '==', VALOR_VIEJO).get()
  console.log(`Encontrados ${snap.size} cursos con tipo="${VALOR_VIEJO}".`)

  const batch = db.batch()
  snap.forEach((d) => {
    console.log(`  ${d.id} (${d.data().nombre ?? ''}): tipo="${VALOR_VIEJO}" -> tipo="${VALOR_NUEVO}"`)
    if (!dryRun) {
      batch.update(d.ref, { tipo: VALOR_NUEVO })
    }
  })

  if (!dryRun && snap.size > 0) {
    await batch.commit()
  }

  console.log(dryRun ? 'Modo --dry-run: no se escribió nada.' : 'Listo.')
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})

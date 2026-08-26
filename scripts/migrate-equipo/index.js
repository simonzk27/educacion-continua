// Migración one-off: renombra el campo `sede` de la colección `users` a
// `equipo` y remapea sus valores viejos a los nuevos equipos/líneas de negocio.
//
// Uso:
//   FIREBASE_SERVICE_ACCOUNT='<json de la service account>' node index.js
//   FIREBASE_SERVICE_ACCOUNT='<json>' node index.js --dry-run   (solo reporta, no escribe)

const admin = require('firebase-admin')

const MAPEO = {
  Colombia: 'Educación Continua',
  USA: 'Unimetab',
  'CMC Entrenamiento': 'Academia',
}

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

  const snap = await db.collection('users').get()
  console.log(`Encontrados ${snap.size} usuarios.`)

  let migrados = 0
  let sinMapeo = 0
  let sinSede = 0

  const batchSize = 400
  let batch = db.batch()
  let opsEnBatch = 0

  for (const doc of snap.docs) {
    const data = doc.data()
    if (!('sede' in data)) {
      sinSede += 1
      continue
    }

    const valorViejo = data.sede
    const valorNuevo = MAPEO[valorViejo] ?? null

    if (valorNuevo === null) {
      sinMapeo += 1
      console.warn(`  ! ${doc.id}: valor de "sede" sin mapeo conocido: ${JSON.stringify(valorViejo)} -> equipo queda null`)
    }

    console.log(`  ${doc.id}: sede=${JSON.stringify(valorViejo)} -> equipo=${JSON.stringify(valorNuevo)}`)

    if (!dryRun) {
      batch.update(doc.ref, {
        equipo: valorNuevo,
        sede: admin.firestore.FieldValue.delete(),
      })
      opsEnBatch += 1
      if (opsEnBatch >= batchSize) {
        await batch.commit()
        batch = db.batch()
        opsEnBatch = 0
      }
    }
    migrados += 1
  }

  if (!dryRun && opsEnBatch > 0) {
    await batch.commit()
  }

  console.log('---')
  console.log(`Migrados: ${migrados}`)
  console.log(`Sin campo "sede" (ya migrados o nuevos): ${sinSede}`)
  console.log(`Sin mapeo conocido (equipo quedó null): ${sinMapeo}`)
  console.log(dryRun ? 'Modo --dry-run: no se escribió nada.' : 'Listo.')
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})

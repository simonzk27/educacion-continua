// Migración one-off: separa el campo `equipo` de la colección `users` en dos.
// El campo `equipo` (Educación Continua / Unimetab / Academia) pasa a llamarse
// `tipoCurso`. El nuevo `equipo` (Colombia / USA) queda sin valor: no hay forma
// de reconstruirlo automáticamente, cada colaborador debe editarse manualmente
// desde el módulo Colaboradores para asignarlo.
//
// Uso:
//   FIREBASE_SERVICE_ACCOUNT='<json de la service account>' node index.js
//   FIREBASE_SERVICE_ACCOUNT='<json>' node index.js --dry-run   (solo reporta, no escribe)

const admin = require('firebase-admin')

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
  let sinEquipo = 0

  const batchSize = 400
  let batch = db.batch()
  let opsEnBatch = 0

  for (const doc of snap.docs) {
    const data = doc.data()
    if (!('equipo' in data) || 'tipoCurso' in data) {
      sinEquipo += 1
      continue
    }

    const valorViejo = data.equipo
    console.log(`  ${doc.id}: equipo=${JSON.stringify(valorViejo)} -> tipoCurso=${JSON.stringify(valorViejo)}, equipo=null`)

    if (!dryRun) {
      batch.update(doc.ref, {
        tipoCurso: valorViejo ?? null,
        equipo: null,
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
  console.log(`Sin campo "equipo" o ya migrados: ${sinEquipo}`)
  console.log('Recordá: el nuevo campo "equipo" (Colombia/USA) quedó en null para todos.')
  console.log('Hay que asignarlo manualmente desde Colaboradores para cada persona.')
  console.log(dryRun ? 'Modo --dry-run: no se escribió nada.' : 'Listo.')
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})

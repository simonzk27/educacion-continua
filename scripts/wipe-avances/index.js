// Limpieza one-off: borra todos los docs de la colección `avances` (datos de
// prueba, previos al cambio de "cuántas lecciones" a rango lección
// inicial/final) y resetea `completado`, `confirmado`, `fechaCompletado` en
// TODAS las inscripciones (subcolección `cursos/{cursoId}/inscripciones`),
// para que no queden marcadas como completas sin avance real detrás.
//
// No toca las colecciones `cursos`, `horarios` ni `users`.
//
// Uso (PowerShell):
//   $env:FIREBASE_SERVICE_ACCOUNT_PATH = "C:\ruta\a\serviceAccount.json"
//   node index.js --dry-run
//   node index.js
//
// Uso (bash):
//   FIREBASE_SERVICE_ACCOUNT_PATH=./serviceAccount.json node index.js --dry-run
//   FIREBASE_SERVICE_ACCOUNT='<json inline>' node index.js --dry-run

const fs = require('node:fs')
const admin = require('firebase-admin')

function initAdmin() {
  const path = process.env.FIREBASE_SERVICE_ACCOUNT_PATH
  const inline = process.env.FIREBASE_SERVICE_ACCOUNT
  if (!path && !inline) {
    console.error(
      'Falta credencial: seteá FIREBASE_SERVICE_ACCOUNT_PATH (ruta a un .json) o FIREBASE_SERVICE_ACCOUNT (JSON inline).',
    )
    process.exit(1)
  }
  const serviceAccountJson = path ? fs.readFileSync(path, 'utf8') : inline
  const serviceAccount = JSON.parse(serviceAccountJson)
  admin.initializeApp({ credential: admin.credential.cert(serviceAccount) })
}

async function borrarEnLotes(db, refs, dryRun) {
  const batchSize = 400
  let batch = db.batch()
  let opsEnBatch = 0
  for (const ref of refs) {
    if (!dryRun) {
      batch.delete(ref)
      opsEnBatch += 1
      if (opsEnBatch >= batchSize) {
        await batch.commit()
        batch = db.batch()
        opsEnBatch = 0
      }
    }
  }
  if (!dryRun && opsEnBatch > 0) {
    await batch.commit()
  }
}

async function main() {
  const dryRun = process.argv.includes('--dry-run')
  initAdmin()
  const db = admin.firestore()

  const avancesSnap = await db.collection('avances').get()
  console.log(`Encontrados ${avancesSnap.size} avances.`)
  await borrarEnLotes(db, avancesSnap.docs.map((d) => d.ref), dryRun)
  console.log(dryRun ? 'Modo --dry-run: avances no se borraron.' : `Avances borrados: ${avancesSnap.size}`)

  const inscripcionesSnap = await db.collectionGroup('inscripciones').get()
  console.log(`Encontradas ${inscripcionesSnap.size} inscripciones.`)

  let reseteadas = 0
  let yaLimpias = 0
  const batchSize = 400
  let batch = db.batch()
  let opsEnBatch = 0

  for (const doc of inscripcionesSnap.docs) {
    const data = doc.data()
    if (data.completado === false && data.confirmado === false && data.fechaCompletado == null) {
      yaLimpias += 1
      continue
    }
    reseteadas += 1
    if (!dryRun) {
      batch.update(doc.ref, {
        completado: false,
        confirmado: false,
        fechaCompletado: null,
      })
      opsEnBatch += 1
      if (opsEnBatch >= batchSize) {
        await batch.commit()
        batch = db.batch()
        opsEnBatch = 0
      }
    }
  }
  if (!dryRun && opsEnBatch > 0) {
    await batch.commit()
  }

  console.log('---')
  console.log(`Inscripciones reseteadas: ${reseteadas}`)
  console.log(`Inscripciones ya limpias: ${yaLimpias}`)
  console.log(dryRun ? 'Modo --dry-run: no se escribió nada.' : 'Listo.')
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})

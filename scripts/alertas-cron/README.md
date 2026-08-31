# Alertas por correo — job programado

Este script corre cada 30 min vía GitHub Actions (`.github/workflows/alertas-cron.yml`),
revisa `config/alertas` en Firestore, y manda un correo (vía un Web App de Google Apps
Script) a cada colaborador **activo** que tenga una sesión programada dentro de los
próximos `minutosAntes` minutos.

100% gratis a esta escala: GitHub Actions (repo público = ilimitado; privado = 2,000 min/mes
gratis, este job usa ~1,440 min/mes) + Apps Script/Gmail (100 correos/día en cuenta Gmail
normal, 1,500/día en Workspace — sin costo ninguno de los dos).

## Configurar (una sola vez)

### 1. Web App de Apps Script (envía los correos)

El código vive en `apps-script/Code.gs` de esta carpeta — es la fuente de verdad, copiá
ese archivo tal cual al editor.

1. Andá a [script.google.com](https://script.google.com) → **Nuevo proyecto**.
2. Pegá el contenido de `apps-script/Code.gs`.
3. ⚙️ **Configuración del proyecto** → **Propiedades de secuencia de comandos** → agregá
   `SHARED_SECRET` con un valor random largo (guardalo, lo necesitás en el paso 3).
4. **Implementar → Nueva implementación** → tipo **Aplicación web** → Ejecutar como: *Yo*,
   Acceso: *Cualquier usuario* → **Implementar** → autorizá los permisos.
5. Copiá la URL que termina en `/exec`.

### 2. Cuenta de servicio de Firebase

1. Andá a la [consola de Firebase](https://console.firebase.google.com/project/educacion-continua-f53fa/settings/serviceaccounts/adminsdk).
2. **Generar nueva clave privada** → descarga un archivo `.json`.
3. Abrí ese archivo, copiá **todo** su contenido (es un JSON completo).

### 3. Cargar los secrets en GitHub

En el repo: **Settings → Secrets and variables → Actions → New repository secret**.
Creá estos tres:

| Nombre | Valor |
|---|---|
| `FIREBASE_SERVICE_ACCOUNT` | El JSON completo del paso 2 (pegalo tal cual) |
| `APPSCRIPT_URL` | La URL `/exec` del paso 1.5 |
| `APPSCRIPT_TOKEN` | El mismo valor que pusiste en `SHARED_SECRET` (paso 1.3) |

Si ya habías cargado `RESEND_API_KEY` / `ALERTAS_FROM_EMAIL` de un intento anterior, podés
borrarlos — ya no se usan.

### 4. Activar en la app

Andá al módulo **Alertas** dentro de la app, activá el toggle y elegí cuánto tiempo antes
avisar. Guardá.

### 5. Probar

En GitHub: **Actions → Enviar alertas de sesiones → Run workflow** (botón manual, no hace
falta esperar el cron) para probar que corre bien. Mirá los logs del run.

## Cómo funciona (por si hay que tocarlo)

- Lee `config/alertas` (activo/minutosAntes), `users`, `cursos`, `horarios` completos.
- Para cada horario, calcula si su próxima ocurrencia (hoy o mañana, según el patrón
  semanal/mensual) cae dentro de la ventana de aviso.
- Evita duplicados con la colección `alertasEnviadas` (doc id = `horarioId_fecha`): antes de
  mandar, intenta crear ese doc con `.create()` — si ya existe, falla y se salta el envío.
  Así aunque el cron corra cada 30 min y la ventana se solape, nunca manda dos veces la
  misma alerta.
- Corre con el Admin SDK de Firebase, que ignora las reglas de seguridad de Firestore —
  por eso no hace falta tocar `firestore.rules` para que este script pueda leer/escribir.

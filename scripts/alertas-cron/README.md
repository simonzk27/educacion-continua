# Alertas por correo — job programado

Este script corre cada 30 min vía GitHub Actions (`.github/workflows/alertas-cron.yml`),
revisa `config/alertas` en Firestore, y manda un correo (via Resend) a cada colaborador
**activo** que tenga una sesión programada dentro de los próximos `minutosAntes` minutos.

100% gratis a esta escala: GitHub Actions (repo público = ilimitado; privado = 2,000 min/mes
gratis, este job usa ~1,440 min/mes) + Resend (3,000 correos/mes gratis).

## Configurar (una sola vez)

### 1. Cuenta en Resend

1. Andá a [resend.com](https://resend.com) y creá una cuenta gratis.
2. En el dashboard, **API Keys** → **Create API Key** → copiá el valor (empieza con `re_`).
3. (Opcional pero recomendado más adelante) Verificá tu propio dominio en **Domains** para
   que los correos no lleguen como "onboarding@resend.dev" y tengan mejor entregabilidad.
   Mientras no lo hagas, el script manda desde `onboarding@resend.dev`, que Resend permite
   sin verificar dominio — funciona, solo se ve menos profesional.

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
| `RESEND_API_KEY` | La API key del paso 1 (`re_...`) |
| `ALERTAS_FROM_EMAIL` | Opcional. Si no lo creás, usa `onboarding@resend.dev` |

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

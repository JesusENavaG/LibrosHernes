# 🚀 Cómo publicar LibrosHernes en internet (Render)

La tienda ya funciona en tu PC (`localhost:3000`), pero esa URL solo
existe en tu computadora. Con estos pasos queda en una **URL pública**
que abrís desde el celular, la tablet o cualquier compu.

El archivo **`render.yaml`** de este repo ya trae la configuración
lista, así que el paso manual es corto.

---

## Paso 1 — Crear la cuenta en Render

1. Abrí <https://render.com>
2. **Get Started for Free** → podés registrarte con tu cuenta de **GitHub**
   (la misma del repo `JesusENavaG/LibrosHernes`).

---

## Paso 2 — Crear el servicio desde el blueprint

1. En Render: **New** → **Blueprint**
2. **Connect a repository** → elegí `JesusENavaG/LibrosHernes`
3. Render va a leer el `render.yaml` y ya deja cargado el nombre,
   el runtime de Node.js y las variables no secretas.

---

## Paso 3 — Pegar los valores secretos

Render te va a pedir estas 4 variables (están marcadas como secretas en
el `render.yaml`, así que no se suben a git). Copialas de tu archivo
**`.env`** local:

| Variable en Render | Valor (copiar de tu `.env`) |
|---|---|
| `SUPABASE_URL` | `https://fmdfqaweqafnlmlfwpqo.supabase.co` |
| `SUPABASE_SERVICE_ROLE_KEY` | la clave `sb_secret_...` |
| `DATABASE_URL` | la conexión `postgresql://...pooler.supabase.com...` |
| `ADMIN_PASSWORD` | la contraseña del panel admin |
| `GEMINI_API_KEY` | clave gratis de Google Gemini (ver Paso 3b) |

> ⚠️ Estos valores son privados: nunca los compartas ni los subas a git.

---

## Paso 3b — Activar el chat del Buhito Sabio 🦉 (gratis)

El chat con IA usa **Google Gemini** (nivel gratuito). Pasos:

1. Entrá a <https://aistudio.google.com/apikey> (con cualquier cuenta
   de Google).
2. **Create API key** → copiá la clave.
3. Pegala en Render como variable `GEMINI_API_KEY`.
4. En tu PC: pegala también en tu `.env` local (`GEMINI_API_KEY=...`)
   y reiniciá con `npm start`.

> 💡 Sin la clave, el chat igual funciona en modo básico (responde
> precio y stock desde el catálogo), pero sin la magia completa del búho.

### Sobre la cuota gratuita (importante)

La cuota gratis de Gemini es **por día y por modelo** (unas 20 consultas
por modelo). Para que el Buhito no se quede sin magia, el código usa una
**cadena de modelos** (`ia.js` → `CADENA_MODELOS`): si uno se queda sin
cuota o tiene un pico de demanda, pasa automáticamente al siguiente. Si
se agotan TODOS, responde con el modo básico del catálogo (nunca deja
al cliente sin respuesta).

- Los modelos se resetean **cada día** (medianoche hora de California).
- No hace falta configurar `GEMINI_MODEL`: el valor por defecto ya usa
  la cadena. Solo definilo si querés forzar un modelo puntual.
- Si el negocio crece y necesitan más consultas por día, se puede
  activar el plan de pago de Gemini (muy barato) o agregar otra
  cuenta/clave a la cadena.

### Importante: función de stock seguro (una sola vez)

En <https://supabase.com> → tu proyecto → **SQL Editor**, pegá y
ejecutá el contenido de **`sql/crear_tablas.sql`** (o solo la función
`descontar_stock`, que está al final del archivo). Así el descuento de
stock al confirmar un pedido es 100% a prueba de carreras. Sin esa
función el sistema funciona igual, pero con una protección menor.

---

## Paso 4 — Deploy

1. **Create Web Service** → esperá 2 o 3 minutos.
2. Cuando pase el health check (`/api/health`), tu tienda queda en vivo en:

```
https://libroshernes.onrender.com
```

- 📚 **Tienda:** `https://libroshernes.onrender.com`
- 🔒 **Panel admin:** `https://libroshernes.onrender.com/admin` (ruta oculta: no hay enlaces en la tienda; cambiá `ADMIN_RUTA` en Render para usar otra dirección)

---

## ⚠️ Cosas a tener en cuenta (plan gratis)

- **El servidor se duerme** a los ~15 minutos sin visitas. La **primera
  vez** que entres puede tardar **~1 minuto** en cargar (Render lo
  está despertando). Después queda rápido.
- Cada vez que subas cambios a GitHub, Render **vuelve a publicar solo**.
- Si un día Render borra el servicio por inactividad, volvé a crear el
  blueprint desde el mismo repo: no se pierde nada.

---

## Después del despliegue: probar que todo funciona

Entrá a la URL pública y fijate:

1. El catálogo muestra tus **54 libros con las fotos reales**.
2. El contador del hero dice **"54+"**.
3. Los botones verdes de **WhatsApp** abren la conversación con el
   mensaje armado.
4. En el panel admin ingresás con tu `ADMIN_PASSWORD` y ves los 54 libros.
5. El **botón flotante del búho** 🦉 (esquina inferior derecha) y el
   botón "Consultar al búho" de cada libro abren el chat **superpuesto
   sobre la propia tienda** (se puede seguir recorriendo los libros con
   el chat abierto) y el Buhito responde precios, stock y recomendaciones.

---

## 🛑 Cómo parar el servidor local

Cuando publiques en Render ya no necesitás el `npm start` de tu PC.
Para pararlo: andá a la consola donde corre y presioná `Ctrl + C`.

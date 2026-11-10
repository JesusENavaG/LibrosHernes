# 🗄️ Restaurar el catálogo real (Supabase)

## Qué estaba pasando

La tienda no mostraba los libros reales: se veían solo **6 libros de ejemplo**
con el aviso *"Modo demostración"* y el contador en **"6+"**.

**Motivo:** el proyecto de Supabase ya no existe / no responde.

| Comprobación | Resultado |
|---|---|
| `GET /api/libros` | `{"fuente":"demo", ... "aviso":"No pudimos leer el catálogo real"}` |
| `GET /api/health` | `{"ok":true,"supabase":"supabase","aviso":"..."}` (está configurado pero falla) |
| DNS de `fmdfqaweqafnlmlfwpqo.supabase.co` | **No existe** (NXDOMAIN con Google DNS 8.8.8.8) |
| `supabase.com` | Sí resuelve → el problema es el proyecto, no la red |

Antes el sitio seguía mostrando el catálogo de ejemplo **sin explicar el motivo**.
Ahora (`datos.js`, `server.js`, `public/js/app.js`) el aviso dice exactamente qué
falló, se reintenta con `DATABASE_URL` si Supabase no responde y los tiempos de
espera están acotados para que la página no se quede pensando.

## Lo que NO se perdió (está todo en este repo)

- `catalogo-libros.csv` → los 54 libros (título, autor, editorial)
- `public/img/libros/` → las 54 fotos reales
- `sql/crear_tablas.sql` → tablas `libros` y `pedidos`
- `sql/agregar_categoria.sql` → columna `categoria` (se agregó después)
- `scripts/categorias-existentes.json` → categorías ya asignadas

---

## Paso 1 — Crear (o recuperar) el proyecto en Supabase

1. Entrá a <https://supabase.com> y revisá si el proyecto
   `fmdfqaweqafnlmlfwpqo` sigue vivo (puede estar *pausado*: ahí mismo hay un
   botón para reactivarlo y no hace falta nada más).
2. Si fue borrado: **New project** → elegí región (US East está bien) →
   guardá la contraseña de la base.
3. **Project Settings → API** y copiá:
   - `Project URL` → esto va en `SUPABASE_URL`
   - `service_role` key → esto va en `SUPABASE_SERVICE_ROLE_KEY`
4. **Project Settings → Database → Connection string (Session pooler)**
   → copiá el `postgresql://...` → esto va en `DATABASE_URL`.

## Paso 2 — Crear las tablas

En **SQL Editor → New query**, pegá y ejecutá (en este orden):

1. el contenido de **`sql/crear_tablas.sql`**
2. el contenido de **`sql/agregar_categoria.sql`** (agrega la columna
   `categoria`, sin ella el filtro de categorías no funciona)

## Paso 3 — Cargar los 54 libros (desde tu PC)

1. Actualizá tu **`.env`** con los valores nuevos del Paso 1
   (`SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `DATABASE_URL`).
2. Ejecutá, en orden:

```bash
npm install
node scripts/importar-catalogo.js          # inserta los 54 libros con su foto
node scripts/sincronizar-catalogo.js       # corrige título/autor/descripción según el CSV
node scripts/asignar-categorias.js         # simulacro: revisa qué cambiaría
node scripts/asignar-categorias.js --aplicar   # escribe las categorías
```

3. Probá el servidor:

```bash
npm start
# en otra terminal o en el navegador:
#   http://localhost:3000/api/health   → {"ok":true,"supabase":"supabase"}  (sin "aviso")
#   http://localhost:3000/api/libros   → "fuente":"supabase" y 54 libros
```

> 💡 `importar-catalogo.js` usa precio único **$5000** y **stock 1** (constantes
> `PRECIO` y `STOCK` de ese archivo, líneas 16-17). Los precios se pueden
> ajustar después desde el panel admin (`/admin`).

## Paso 4 — Actualizar Render

En Render → tu servicio → **Environment**, reemplazá las variables secretas:

| Variable | Valor |
|---|---|
| `SUPABASE_URL` | la nueva Project URL |
| `SUPABASE_SERVICE_ROLE_KEY` | la nueva clave `service_role` |
| `DATABASE_URL` | la nueva connection string |

Guardá (Render redespliega solo) y esperá a que pase el health check.

## Paso 5 — Verificar que vuelvan los libros

1. `https://libroshernes.onrender.com/api/health` → `"supabase":"supabase"` **sin** `aviso`.
2. `https://libroshernes.onrender.com/api/libros` → `"fuente":"supabase"` y **54** libros.
3. La tienda → contador **"54+"**, 54 tarjetas con fotos reales y **sin** el aviso amarillo.

---

## Si querés revisar el código del cambio

- `datos.js` → `conRespaldoPg()`: si Supabase no responde, la lectura se
  reintenta con `DATABASE_URL` antes de rendirse; `errorActual()` expone el
  último error y `fuente()` informa el motor que realmente respondió.
  Además: `db: { retry: false, timeout: 5000 }` en el cliente Supabase
  (antes reintentaba con esperas de 1s + 2s + 4s = **7 segundos** antes de
  rendirse) y `connectionTimeoutMillis: 5000` en el pool de PostgreSQL
  (antes una base caída dejaba el catálogo colgado). Con eso, con la base
  caída el catálogo responde en **~2-3 segundos** en vez de ~11.
- `server.js` → `/api/health` informa el error técnico y `/api/libros`
  devuelve un aviso claro y amigable.
- `public/js/app.js` → el aviso del catálogo muestra el motivo en vez del
  texto genérico, y si la consulta pasa de 2,5s el "Cargando libros..."
  cambia a "Seguimos conectando con el catálogo…".

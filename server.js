// ============================================================
//  LibrosHernes - Backend (Node.js + Express + Supabase)
//  Front estático (HTML/CSS/JS) + API REST
// ============================================================
require('dotenv').config();

const express = require('express');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const multer = require('multer');
const datos = require('./datos');
const ia = require('./ia');

// ------------------------------------------------------------
// Configuración
// ------------------------------------------------------------
const PORT = process.env.PORT || 3000;
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'Chiquita123';
const WHATSAPP_NUMBER = process.env.WHATSAPP_NUMBER || '5491173667668';
const BUCKET = process.env.BUCKET_IMAGENES || 'libros';
const TABLA_LIBROS = process.env.TABLA_LIBROS || 'libros';
const TABLA_PEDIDOS = process.env.TABLA_PEDIDOS || 'pedidos';

// La capa de datos (datos.js) usa Supabase si hay claves, y si no
// la conexión directa a PostgreSQL (DATABASE_URL).
const estaConectado = () => datos.hayConexion();
const normalizarLibro = datos.normalizarLibro;

// ------------------------------------------------------------
// Datos de demostración (se usan mientras no haya Supabase)
// ------------------------------------------------------------
const LIBROS_DEMO = [
  {
    id: 'demo-1',
    titulo: 'Cien años de soledad',
    autor: 'Gabriel García Márquez',
    descripcion:
      'La obra cumbre del realismo mágico: la historia de la familia Buendía a lo largo de siete generaciones en el pueblo de Macondo.',
    precio: 12999,
    imagen_url: '/img/covers/cien-anos.svg',
    stock: 10,
    activo: true,
  },
  {
    id: 'demo-2',
    titulo: 'El principito',
    autor: 'Antoine de Saint-Exupéry',
    descripcion:
      'Una fábula poética sobre la amistad, el amor y lo esencial que es invisible a los ojos. Un clásico para todas las edades.',
    precio: 8999,
    imagen_url: '/img/covers/el-principito.svg',
    stock: 15,
    activo: true,
  },
  {
    id: 'demo-3',
    titulo: '1984',
    autor: 'George Orwell',
    descripcion:
      'La novela distópica por excelencia sobre la vigilancia masiva, la manipulación de la verdad y el control totalitario.',
    precio: 11499,
    imagen_url: '/img/covers/1984.svg',
    stock: 8,
    activo: true,
  },
  {
    id: 'demo-4',
    titulo: 'Don Quijote de la Mancha',
    autor: 'Miguel de Cervantes',
    descripcion:
      'Las aventuras del ingenioso hidalgo y su fiel escudero Sancho Panza. La obra cumbre de la literatura en español.',
    precio: 15999,
    imagen_url: '/img/covers/don-quijote.svg',
    stock: 6,
    activo: true,
  },
  {
    id: 'demo-5',
    titulo: 'Rayuela',
    autor: 'Julio Cortázar',
    descripcion:
      'Un laberinto literario para leer en varios órdenes: obra clave de la literatura latinoamericana del siglo XX.',
    precio: 10999,
    imagen_url: '/img/covers/rayuela.svg',
    stock: 9,
    activo: true,
  },
  {
    id: 'demo-6',
    titulo: 'Harry Potter y la piedra filosofal',
    autor: 'J. K. Rowling',
    descripcion:
      'El inicio de la saga del niño mago que conquistó a lectores de todo el mundo. Fantasía para toda la familia.',
    precio: 13999,
    imagen_url: '/img/covers/harry-potter.svg',
    stock: 12,
    activo: true,
  },
];

// Copia mutable: en modo demo el panel admin puede editarla
let librosDemo = LIBROS_DEMO.map((l) => ({ ...l }));
const pedidosDemo = [];

// ------------------------------------------------------------
// App
// ------------------------------------------------------------
const app = express();
app.use(express.json({ limit: '8mb' }));
app.use(express.static(path.join(__dirname, 'public')));

// ------------------------------------------------------------
//  PANEL DE ADMINISTRACIÓN - RUTA OCULTA
//  El panel NO vive en /public: solo se sirve en la ruta secreta
//  (por defecto /admin, configurable con ADMIN_RUTA en .env).
//  No hay ningún enlace hacia ella en la tienda y los buscadores
//  no la indexan.
// ------------------------------------------------------------
const RUTA_ADMIN = ('/' + String(process.env.ADMIN_RUTA || 'admin').replace(/^\/+|\/+$/g, '')).toLowerCase();
const VISTA_ADMIN = path.join(__dirname, 'views', 'admin.html');
const SCRIPT_ADMIN = path.join(__dirname, 'views', 'admin.js');

app.use((req, res, next) => {
  if (req.method !== 'GET') return next();

  const ruta = (req.path.length > 1 ? req.path.replace(/\/+$/, '') : req.path).toLowerCase();

  // El HTML del panel
  if (ruta === RUTA_ADMIN) {
    res.set('X-Robots-Tag', 'noindex, nofollow, noarchive');
    if (!fs.existsSync(VISTA_ADMIN)) return res.status(404).send('No encontrado');
    return res.type('html').send(fs.readFileSync(VISTA_ADMIN, 'utf8').split('__RUTA_ADMIN__').join(RUTA_ADMIN));
  }

  // El script del panel (solo se sirve junto con la ruta secreta)
  if (ruta === `${RUTA_ADMIN}.js`) {
    res.set('X-Robots-Tag', 'noindex, nofollow, noarchive');
    if (!fs.existsSync(SCRIPT_ADMIN)) return res.status(404).send('No encontrado');
    return res.type('application/javascript').send(fs.readFileSync(SCRIPT_ADMIN, 'utf8'));
  }

  // La dirección vieja ya no existe: manda a la tienda
  if (ruta === '/admin.html') return res.redirect('/');

  next();
});

// ------------------------------------------------------------
// Utilidades
// ------------------------------------------------------------
const soloNumeros = (v) => String(v || '').replace(/\D/g, '');

function esPasswordValida(recibida) {
  const a = crypto.createHash('sha256').update(String(recibida || '')).digest();
  const b = crypto.createHash('sha256').update(ADMIN_PASSWORD).digest();
  return crypto.timingSafeEqual(a, b);
}

// Tokens de admin en memoria (valen 8 horas)
const tokens = new Map();
function crearToken() {
  const token = crypto.randomBytes(32).toString('hex');
  tokens.set(token, Date.now() + 8 * 60 * 60 * 1000);
  return token;
}
function requiereAdmin(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.replace(/^Bearer\s+/i, '');
  const expira = tokens.get(token);
  if (!expira) return res.status(401).json({ error: 'No autorizado' });
  if (Date.now() > expira) {
    tokens.delete(token);
    return res.status(401).json({ error: 'Sesión expirada, volvé a entrar' });
  }
  next();
}

// ============================================================
//  API PÚBLICA
// ============================================================

// Configuración para el front (número de WhatsApp, estado de la BBDD)
app.get('/api/config', (req, res) => {
  res.json({
    empresa: 'LibrosHernes',
    whatsapp: WHATSAPP_NUMBER,
    supabase_conectado: estaConectado(),
    ia_activa: ia.configurado(),
    ia_modelo: ia.modelo(),
  });
});

app.get('/api/health', async (req, res) => {
  res.json({ ok: true, supabase: estaConectado() ? datos.fuente() : 'demo' });
});

// Listar libros (catálogo público: solo activos y con stock)
app.get('/api/libros', async (req, res) => {
  if (!estaConectado()) {
    return res.json({
      fuente: 'demo',
      libros: librosDemo.filter((l) => l.activo && l.stock > 0),
    });
  }
  try {
    const libros = await datos.listarLibros({ soloActivos: true, soloConStock: true });
    res.json({ fuente: datos.fuente(), libros });
  } catch (e) {
    console.error('Error leyendo libros:', e.message);
    res.json({ fuente: 'demo', libros: librosDemo.filter((l) => l.activo), aviso: e.message });
  }
});

// Detalle de un libro
app.get('/api/libros/:id', async (req, res) => {
  const { id } = req.params;
  if (!estaConectado()) {
    const libro = librosDemo.find((l) => l.id === id);
    return libro
      ? res.json({ fuente: 'demo', libro })
      : res.status(404).json({ error: 'Libro no encontrado' });
  }
  try {
    const libro = await datos.obtenerLibro(id);
    if (!libro) return res.status(404).json({ error: 'Libro no encontrado' });
    res.json({ fuente: datos.fuente(), libro });
  } catch (e) {
    res.status(500).json({ error: 'No se pudo leer el libro', detalle: e.message });
  }
});

// Crear pedido (formulario de requerimiento)
// IMPORTANTE: al confirmarse el pedido se descuenta el stock; si un libro
// se queda sin ejemplares, deja de aparecer en el catálogo público.
app.post('/api/pedidos', async (req, res) => {
  const { nombre, telefono, email, direccion, comentarios, detalles, total } = req.body || {};

  if (!nombre || !String(nombre).trim()) {
    return res.status(400).json({ error: 'El nombre es obligatorio' });
  }
  if (!soloNumeros(telefono)) {
    return res.status(400).json({ error: 'El teléfono es obligatorio' });
  }
  if (!Array.isArray(detalles) || detalles.length === 0) {
    return res.status(400).json({ error: 'El pedido no tiene libros' });
  }

  const pedido = {
    nombre: String(nombre).trim(),
    telefono: soloNumeros(telefono),
    email: email ? String(email).trim() : null,
    direccion: direccion ? String(direccion).trim() : null,
    comentarios: comentarios ? String(comentarios).trim() : null,
    detalles,
    total: Number(total) || 0,
    estado: 'pendiente',
  };

  if (!estaConectado()) {
    // Modo demo: descuenta stock en memoria y guarda el pedido
    const descontados = [];
    for (const d of detalles) {
      const libro = librosDemo.find((l) => l.id === d.id);
      const cantidad = Math.max(1, Number(d.cantidad) || 1);
      if (!libro || libro.stock < cantidad) {
        for (const x of descontados) x.libro.stock += x.cantidad; // revertir
        const nombreLibro = (libro && libro.titulo) || d.titulo || 'un libro';
        return res.status(409).json({
          error: `No quedan ejemplares suficientes de "${nombreLibro}". Quitá ese libro del carrito e intentá de nuevo.`,
        });
      }
      libro.stock -= cantidad;
      descontados.push({ libro, cantidad });
    }
    const id = `demo-${Date.now()}`;
    pedidosDemo.push({ id, ...pedido, created_at: new Date().toISOString() });
    console.log('📦 Pedido (demo):', pedido.nombre, pedido.telefono, `$${pedido.total}`);
    return res.json({ ok: true, fuente: 'demo', id, aviso: 'Pedido guardado en memoria (demo)' });
  }

  try {
    // 1) Descontar stock (si algo falla, se devuelve lo ya descontado)
    const descontados = [];
    for (const d of detalles) {
      const cantidad = Math.max(1, Number(d.cantidad) || 1);
      const r = await datos.descontarStock(d.id, cantidad);
      if (!r.ok) {
        for (const x of descontados) await datos.devolverStock(x.id, x.cantidad).catch(() => {});
        const libro = await datos.obtenerLibro(d.id).catch(() => null);
        const nombreLibro = (libro && libro.titulo) || d.titulo || 'un libro';
        return res.status(409).json({
          error: `No quedan ejemplares suficientes de "${nombreLibro}". Quitá ese libro del carrito e intentá de nuevo.`,
        });
      }
      descontados.push({ id: d.id, cantidad });
    }

    // 2) Crear el pedido (si falla, se devuelve el stock descontado)
    try {
      const id = await datos.crearPedido(pedido);
      console.log('📦 Pedido recibido:', pedido.nombre, pedido.telefono, `$${pedido.total}`);
      res.json({ ok: true, fuente: datos.fuente(), id });
    } catch (e) {
      for (const x of descontados) await datos.devolverStock(x.id, x.cantidad).catch(() => {});
      throw e;
    }
  } catch (e) {
    console.error('Error guardando pedido:', e.message);
    res.status(500).json({ error: 'No se pudo guardar el pedido', detalle: e.message });
  }
});

// ============================================================
//  CHAT CON IA — EL BUHITO SABIO 🦉
//  (Gemini desde el backend: la clave nunca llega al navegador)
// ============================================================
app.post('/api/chat', async (req, res) => {
  const ip =
    (req.headers['x-forwarded-for'] || '').split(',')[0].trim() ||
    req.socket.remoteAddress ||
    'desconocida';

  if (!ia.verLimite(ip)) {
    return res.status(429).json({
      error: 'Me estoy quedando sin magia por un minuto 😅. Esperá unos segundos y probá de nuevo.',
    });
  }

  const { mensaje, historial, libro_id } = req.body || {};
  const texto = String(mensaje || '').trim();
  if (!texto) return res.status(400).json({ error: 'Escribí tu consulta para el Buhito Sabio' });
  if (texto.length > 1000) {
    return res.status(400).json({ error: 'Tu consulta es muy larga: máximo 1000 caracteres.' });
  }

  try {
    // Catálogo disponible (los mismos libros que ve el cliente en la tienda)
    let catalogo;
    if (estaConectado()) {
      catalogo = await datos.listarLibros({ soloActivos: true, soloConStock: true });
    } else {
      catalogo = librosDemo.filter((l) => l.activo && l.stock > 0);
    }

    // Libro que el cliente está mirando (si abrió el chat desde una ficha)
    const libro = libro_id
      ? catalogo.find((l) => String(l.id) === String(libro_id)) || null
      : null;

    const r = await ia.responder({ mensaje: texto, historial, catalogo, libro });
    res.json({ respuesta: r.texto, fuente: r.fuente });
  } catch (e) {
    console.error('Error en /api/chat:', e.message);
    res.status(502).json({ error: 'El búho tropezó con una rama ⚠️. Probá de nuevo en unos segundos.' });
  }
});

// ============================================================
//  API DE ADMINISTRACIÓN
// ============================================================

// Intentos fallidos de login por IP (fuerza bruta)
const intentosLogin = new Map(); // ip -> { fallos, bloqueadoHasta }
const MAX_FALLOS = 5;
const BLOQUEO_MS = 15 * 60 * 1000;

function ipDe(req) {
  return (req.headers['x-forwarded-for'] || '').split(',')[0].trim() ||
    req.socket.remoteAddress ||
    'desconocida';
}

app.post('/api/admin/login', (req, res) => {
  const ip = ipDe(req);
  const registro = intentosLogin.get(ip);

  if (registro && registro.bloqueadoHasta > Date.now()) {
    const minutos = Math.ceil((registro.bloqueadoHasta - Date.now()) / 60000);
    return res.status(429).json({
      error: `Demasiados intentos fallidos. Intentá de nuevo en ${minutos} minuto${minutos === 1 ? '' : 's'}.`,
    });
  }

  const { password } = req.body || {};
  if (!esPasswordValida(password)) {
    const r = registro || { fallos: 0, bloqueadoHasta: 0 };
    r.fallos += 1;
    const fallos = r.fallos;
    if (r.fallos >= MAX_FALLOS) {
      r.bloqueadoHasta = Date.now() + BLOQUEO_MS;
      r.fallos = 0;
      console.log('🔒 IP bloqueada 15 min tras ' + fallos + ' intentos fallidos:', ip);
    } else {
      console.log('⚠️  Login fallido (' + fallos + '/' + MAX_FALLOS + ') IP:', ip);
    }
    intentosLogin.set(ip, r);
    return res.status(401).json({ error: 'Contraseña incorrecta' });
  }

  intentosLogin.delete(ip);
  res.json({ ok: true, token: crearToken() });
});

app.get('/api/admin/libros', requiereAdmin, async (req, res) => {
  if (!estaConectado()) {
    return res.json({ fuente: 'demo', libros: librosDemo });
  }
  try {
    const libros = await datos.listarLibros();
    res.json({ fuente: datos.fuente(), libros });
  } catch (e) {
    res.status(500).json({ error: 'No se pudieron leer los libros', detalle: e.message });
  }
});

app.post('/api/admin/libros', requiereAdmin, async (req, res) => {
  const { titulo, autor, descripcion, precio, imagen_url, stock, activo } = req.body || {};
  if (!titulo || !String(titulo).trim()) {
    return res.status(400).json({ error: 'El título es obligatorio' });
  }
  const libro = {
    titulo: String(titulo).trim(),
    autor: autor ? String(autor).trim() : null,
    descripcion: descripcion ? String(descripcion).trim() : null,
    precio: Number(precio) || 0,
    imagen_url: imagen_url || null,
    stock: Number(stock) || 0,
    activo: activo !== false,
  };

  if (!estaConectado()) {
    const nuevo = { id: `demo-${Date.now()}`, ...libro };
    librosDemo.unshift(nuevo);
    return res.json({ ok: true, fuente: 'demo', libro: nuevo });
  }
  try {
    const nuevo = await datos.crearLibro(libro);
    res.json({ ok: true, fuente: datos.fuente(), libro: nuevo });
  } catch (e) {
    res.status(500).json({ error: 'No se pudo crear el libro', detalle: e.message });
  }
});

app.put('/api/admin/libros/:id', requiereAdmin, async (req, res) => {
  const { id } = req.params;
  const { titulo, autor, descripcion, precio, imagen_url, stock, activo } = req.body || {};
  if (!titulo || !String(titulo).trim()) {
    return res.status(400).json({ error: 'El título es obligatorio' });
  }
  const libro = {
    titulo: String(titulo).trim(),
    autor: autor ? String(autor).trim() : null,
    descripcion: descripcion ? String(descripcion).trim() : null,
    precio: Number(precio) || 0,
    imagen_url: imagen_url || null,
    stock: Number(stock) || 0,
    activo: Boolean(activo),
  };

  if (!estaConectado()) {
    const i = librosDemo.findIndex((l) => l.id === id);
    if (i === -1) return res.status(404).json({ error: 'Libro no encontrado' });
    librosDemo[i] = { ...librosDemo[i], ...libro };
    return res.json({ ok: true, fuente: 'demo', libro: librosDemo[i] });
  }
  try {
    const actualizado = await datos.editarLibro(id, libro);
    if (!actualizado) return res.status(404).json({ error: 'Libro no encontrado' });
    res.json({ ok: true, fuente: datos.fuente(), libro: actualizado });
  } catch (e) {
    res.status(500).json({ error: 'No se pudo editar el libro', detalle: e.message });
  }
});

app.delete('/api/admin/libros/:id', requiereAdmin, async (req, res) => {
  const { id } = req.params;
  if (!estaConectado()) {
    const i = librosDemo.findIndex((l) => l.id === id);
    if (i === -1) return res.status(404).json({ error: 'Libro no encontrado' });
    librosDemo.splice(i, 1);
    return res.json({ ok: true, fuente: 'demo' });
  }
  try {
    const borrado = await datos.borrarLibro(id);
    if (!borrado) return res.status(404).json({ error: 'Libro no encontrado' });
    res.json({ ok: true, fuente: datos.fuente() });
  } catch (e) {
    res.status(500).json({ error: 'No se pudo eliminar el libro', detalle: e.message });
  }
});

// Subir imagen del libro a Supabase Storage
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const permitidos = ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/svg+xml'];
    cb(null, permitidos.includes(file.mimetype));
  },
});

app.post('/api/admin/libros/:id/imagen', requiereAdmin, upload.single('imagen'), async (req, res) => {
  const { id } = req.params;
  if (!req.file) return res.status(400).json({ error: 'No se envió ninguna imagen válida' });
  try {
    const extension = (req.file.originalname.split('.').pop() || 'jpg').toLowerCase();

    let publicUrl;
    if (datos.supabase) {
      // Con claves de Supabase: sube al bucket de Storage
      const ruta = `${id}/${Date.now()}-${crypto.randomBytes(4).toString('hex')}.${extension}`;
      const { error: upError } = await datos.supabase.storage
        .from(BUCKET)
        .upload(ruta, req.file.buffer, { contentType: req.file.mimetype, upsert: false });
      if (upError) throw upError;
      const { data: urlData } = datos.supabase.storage.from(BUCKET).getPublicUrl(ruta);
      publicUrl = urlData.publicUrl;
    } else {
      // Sin claves: guarda la imagen en el servidor (public/img/libros)
      const carpeta = path.join(__dirname, 'public', 'img', 'libros');
      fs.mkdirSync(carpeta, { recursive: true });
      const nombre = `${id}-${Date.now()}-${crypto.randomBytes(4).toString('hex')}.${extension}`;
      fs.writeFileSync(path.join(carpeta, nombre), req.file.buffer);
      publicUrl = `/img/libros/${nombre}`;
    }

    await datos.actualizarImagen(id, publicUrl);
    res.json({ ok: true, imagen_url: publicUrl });
  } catch (e) {
    console.error('Error subiendo imagen:', e.message);
    res.status(500).json({ error: 'No se pudo subir la imagen', detalle: e.message });
  }
});

// ============================================================
//  Front: cualquier otra ruta GET sirve el index.html
// ============================================================
app.use((req, res, next) => {
  if (req.method !== 'GET' || req.path.startsWith('/api/')) return next();
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Manejo de errores (JSON en todas las rutas)
app.use((err, req, res, next) => {
  console.error('Error:', err.message);
  res.status(500).json({ error: 'Error interno del servidor', detalle: err.message });
});

// ------------------------------------------------------------
app.listen(PORT, () => {
  console.log('==============================================');
  console.log('  📚 LibrosHernes en http://localhost:' + PORT);
  console.log('  🔒 Panel admin (ruta oculta): http://localhost:' + PORT + RUTA_ADMIN);
  console.log('  🔌 Supabase: ' + (estaConectado() ? 'conectado ✅' : 'modo demo ⚙️'));
  console.log('==============================================');
});

// Limpieza periódica de sesiones e intentos de login viejos
setInterval(() => {
  const ahora = Date.now();
  for (const [t, expira] of tokens) if (ahora > expira) tokens.delete(t);
  for (const [ip, r] of intentosLogin) {
    if (r.bloqueadoHasta && ahora > r.bloqueadoHasta + BLOQUEO_MS) intentosLogin.delete(ip);
    else if (!r.bloqueadoHasta && r.fallos === 0) intentosLogin.delete(ip);
  }
}, 10 * 60 * 1000).unref();

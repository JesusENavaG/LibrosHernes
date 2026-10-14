/* ============================================================
   LibrosHernes - Lógica del front (catálogo, carrito,
   WhatsApp y formulario de pedido)
   ============================================================ */

// ---------------- Estado global ----------------
const estado = {
  libros: [],
  carrito: [],        // { id, titulo, precio, imagen_url, cantidad }
  config: { whatsapp: '5491173667668', supabase_conectado: false },
  libroAbierto: null,
  busqueda: '',
  orden: 'destacados',
};

const CLAVE_CARRITO = 'carritoLibrosHernes';

// ---------------- Utilidades ----------------
const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => document.querySelectorAll(sel);

const formatearPrecio = (n) =>
  new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 }).format(n);

const escapeHtml = (str = '') =>
  String(str).replace(/[&<>"']/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

function toast(mensaje, tipo = '') {
  const el = $('#toast');
  el.textContent = mensaje;
  el.className = 'toast ' + (tipo ? `toast--${tipo}` : '');
  el.hidden = false;
  clearTimeout(el._timer);
  el._timer = setTimeout(() => { el.hidden = true; }, 3000);
}

// ---------------- Respaldo local (si no hay servidor) ----------------
// Mismos libros que usa server.js en modo demo. Se muestran cuando la API no
// responde (Live Server de VS Code, doble clic sobre index.html, backend caído),
// para que el catálogo nunca quede vacío.
const LIBROS_RESPALDO = [
  {
    id: 'demo-1',
    titulo: 'Cien años de soledad',
    autor: 'Gabriel García Márquez',
    descripcion:
      'La obra cumbre del realismo mágico: la historia de la familia Buendía a lo largo de siete generaciones en el pueblo de Macondo.',
    precio: 12999,
    imagen_url: 'img/covers/cien-anos.svg',
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
    imagen_url: 'img/covers/el-principito.svg',
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
    imagen_url: 'img/covers/1984.svg',
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
    imagen_url: 'img/covers/don-quijote.svg',
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
    imagen_url: 'img/covers/rayuela.svg',
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
    imagen_url: 'img/covers/harry-potter.svg',
    stock: 12,
    activo: true,
  },
];

const AVISO_DEMO = ($('#avisoDemo') || {}).textContent || '';

// Explica por qué no hay API, según cómo se esté abriendo la página
function mensajeSinServidor() {
  if (location.protocol === 'file:') {
    return 'Abriste el archivo con doble clic: eso no levanta el servidor. Ejecutá npm start y abrí http://localhost:3000';
  }
  const puerto = location.port || (location.protocol === 'https:' ? '443' : '80');
  if (puerto !== '3000') {
    return `Estás en el puerto ${puerto} (¿Live Server de VS Code?), que solo sirve archivos y no tiene la API. Abrí http://localhost:3000, donde corre el servidor de la tienda`;
  }
  return 'El servidor no está respondiendo. Ejecutá npm start y abrí http://localhost:3000';
}

async function api(ruta, opciones = {}) {
  let res;
  try {
    res = await fetch(ruta, {
      headers: { 'Content-Type': 'application/json' },
      ...opciones,
    });
  } catch (e) {
    throw new Error(`No hay conexión con el servidor. ${mensajeSinServidor()}`);
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.error || `El servidor respondió ${res.status} en ${ruta}. ${mensajeSinServidor()}`);
  }
  return data;
}

// ---------------- Carga de datos ----------------
async function cargarConfig() {
  try {
    const cfg = await api('/api/config');
    estado.config = { ...estado.config, ...cfg };
    const url = `https://wa.me/${estado.config.whatsapp}?text=${encodeURIComponent('¡Hola LibrosHernes! Quiero consultar por un libro 📚')}`;
    ['#btnWhatsappHeader', '#btnWhatsappHero', '#btnWhatsappCta'].forEach((id) => {
      const el = $(id);
      if (el) el.href = url;
    });
    const footer = $('#btnWhatsappFooter');
    if (footer) footer.href = url;
  } catch (e) {
    console.warn('No se pudo cargar la configuración:', e.message);
  }
}

async function cargarLibros() {
  const aviso = $('#avisoDemo');
  try {
    const data = await api('/api/libros');
    estado.libros = data.libros || [];
    aviso.textContent = AVISO_DEMO;
    aviso.hidden = data.fuente !== 'demo';
    renderizarLibros();
    actualizarStatLibros();
  } catch (e) {
    // Sin servidor: catálogo de respaldo para que la página nunca quede vacía
    estado.libros = LIBROS_RESPALDO.map((l) => ({ ...l }));
    renderizarLibros();
    actualizarStatLibros();
    aviso.textContent =
      `⚠️ ${mensajeSinServidor()}. ` +
      `Se muestran ${estado.libros.length} libros de respaldo: podés mirar el catálogo, pero el carrito y el ` +
      `formulario de pedido solo se envían con el servidor corriendo.`;
    aviso.hidden = false;
    console.warn('Catálogo de respaldo (sin API):', e.message);
  }
}

// Contador del hero: siempre refleja el catálogo cargado
function actualizarStatLibros() {
  const el = $('#statLibros');
  if (el && estado.libros.length) el.textContent = estado.libros.length + '+';
}

// ---------------- Render del catálogo ----------------
function librosFiltrados() {
  let lista = [...estado.libros];
  const q = estado.busqueda.trim().toLowerCase();
  if (q) {
    lista = lista.filter(
      (l) =>
        (l.titulo || '').toLowerCase().includes(q) ||
        (l.autor || '').toLowerCase().includes(q)
    );
  }
  switch (estado.orden) {
    case 'precio-asc': lista.sort((a, b) => a.precio - b.precio); break;
    case 'precio-desc': lista.sort((a, b) => b.precio - a.precio); break;
    case 'titulo': lista.sort((a, b) => a.titulo.localeCompare(b.titulo, 'es')); break;
  }
  return lista;
}

function renderizarLibros() {
  const grid = $('#gridLibros');
  const lista = librosFiltrados();

  if (!lista.length) {
    grid.innerHTML = `<p class="catalogo__vacio">🔍 No encontramos libros que coincidan con tu búsqueda.</p>`;
    return;
  }

  grid.innerHTML = lista
    .map((l) => {
      const agotado = l.stock <= 0;
      const imagen = l.imagen_url || 'img/covers/sin-imagen.svg';
      return `
      <article class="tarjeta" data-id="${l.id}">
        <div class="tarjeta__media" data-accion="detalle" data-id="${l.id}">
          <img src="${escapeHtml(imagen)}" alt="${escapeHtml(l.titulo)}" loading="lazy"
               onerror="this.src='img/covers/sin-imagen.svg'" />
          <span class="tarjeta__stock ${agotado ? 'tarjeta__stock--agotado' : ''}">
            ${agotado ? 'Agotado' : `Stock: ${l.stock}`}
          </span>
        </div>
        <div class="tarjeta__cuerpo">
          <h3 class="tarjeta__titulo" data-accion="detalle" data-id="${l.id}">${escapeHtml(l.titulo)}</h3>
          <p class="tarjeta__autor">${escapeHtml(l.autor || 'Sin autor')}</p>
          <p class="tarjeta__desc">${escapeHtml(l.descripcion || 'Sin descripción')}</p>
          <div class="tarjeta__pie">
            <span class="tarjeta__precio">${formatearPrecio(l.precio)}</span>
          </div>
          <div class="tarjeta__acciones">
            <button class="btn btn--primario" data-accion="agregar" data-id="${l.id}" ${agotado ? 'disabled' : ''}>
              Al carrito
            </button>
            <button class="btn" style="background:var(--crema-2);color:var(--tinta)" data-accion="detalle" data-id="${l.id}">
              Ver detalle
            </button>
            <button class="btn btn--whatsapp" data-accion="whatsapp" data-id="${l.id}">
              🟢 Pedir por WhatsApp
            </button>
          </div>
        </div>
      </article>`;
    })
    .join('');
}

// ---------------- Carrito ----------------
function guardarCarrito() {
  localStorage.setItem(CLAVE_CARRITO, JSON.stringify(estado.carrito));
}

function cargarCarrito() {
  try {
    estado.carrito = JSON.parse(localStorage.getItem(CLAVE_CARRITO)) || [];
  } catch {
    estado.carrito = [];
  }
  actualizarContadorCarrito();
}

function actualizarContadorCarrito() {
  const total = estado.carrito.reduce((s, i) => s + i.cantidad, 0);
  $('#contadorCarrito').textContent = total;
}

function agregarAlCarrito(libro, cantidad = 1) {
  if (libro.stock <= 0) return toast('Este libro está agotado', 'error');
  const existente = estado.carrito.find((i) => i.id === libro.id);
  if (existente) {
    existente.cantidad += cantidad;
  } else {
    estado.carrito.push({
      id: libro.id,
      titulo: libro.titulo,
      precio: libro.precio,
      imagen_url: libro.imagen_url,
      cantidad,
    });
  }
  guardarCarrito();
  actualizarContadorCarrito();
  renderizarCarrito();
  toast(`"${libro.titulo}" agregado al carrito 📚`, 'exito');
}

function cambiarCantidad(id, delta) {
  const item = estado.carrito.find((i) => i.id === id);
  if (!item) return;
  item.cantidad += delta;
  if (item.cantidad <= 0) {
    estado.carrito = estado.carrito.filter((i) => i.id !== id);
  }
  guardarCarrito();
  actualizarContadorCarrito();
  renderizarCarrito();
}

function quitarDelCarrito(id) {
  estado.carrito = estado.carrito.filter((i) => i.id !== id);
  guardarCarrito();
  actualizarContadorCarrito();
  renderizarCarrito();
  toast('Libro eliminado del carrito');
}

function totalCarrito() {
  return estado.carrito.reduce((s, i) => s + Number(i.precio) * i.cantidad, 0);
}

function renderizarCarrito() {
  const cuerpo = $('#cuerpoCarrito');
  const pie = $('#pieCarrito');

  if (!estado.carrito.length) {
    cuerpo.innerHTML = '<p class="drawer__vacio">Tu carrito está vacío 📭</p>';
    pie.hidden = true;
    return;
  }

  cuerpo.innerHTML = estado.carrito
    .map(
      (i) => `
      <div class="item-carrito">
        <img src="${escapeHtml(i.imagen_url || 'img/covers/sin-imagen.svg')}" alt="${escapeHtml(i.titulo)}"
             onerror="this.src='img/covers/sin-imagen.svg'" />
        <div>
          <p class="item-carrito__titulo">${escapeHtml(i.titulo)}</p>
          <p class="item-carrito__precio">${formatearPrecio(i.precio)}</p>
          <div class="cantidad">
            <button data-carrito="menos" data-id="${i.id}" aria-label="Quitar uno">−</button>
            <span>${i.cantidad}</span>
            <button data-carrito="mas" data-id="${i.id}" aria-label="Agregar uno">+</button>
          </div>
        </div>
        <button class="item-carrito__quitar" data-carrito="quitar" data-id="${i.id}">Quitar</button>
      </div>`
    )
    .join('');

  $('#totalCarrito').textContent = formatearPrecio(totalCarrito());
  pie.hidden = false;
}

function abrirCarrito() {
  $('#drawerCarrito').classList.add('abierto');
  $('#overlayCarrito').hidden = false;
  renderizarCarrito();
}
function cerrarCarrito() {
  $('#drawerCarrito').classList.remove('abierto');
  $('#overlayCarrito').hidden = true;
}

// ---------------- WhatsApp ----------------
function mensajeCarrito() {
  const lineas = estado.carrito.map(
    (i) => `• ${i.titulo} x${i.cantidad} — ${formatearPrecio(i.precio * i.cantidad)}`
  );
  return (
    '¡Hola LibrosHernes! Quiero hacer este pedido 📚\n\n' +
    lineas.join('\n') +
    `\n\n*Total: ${formatearPrecio(totalCarrito())}*`
  );
}

function mensajeLibro(libro) {
  return (
    `¡Hola LibrosHernes! Me interesa este libro 📚\n\n` +
    `*${libro.titulo}*${libro.autor ? `\nAutor: ${libro.autor}` : ''}\n` +
    `Precio: ${formatearPrecio(libro.precio)}\n\n` +
    `¿Me pasan info de envío y pago?`
  );
}

function abrirWhatsApp(mensaje) {
  const url = `https://wa.me/${estado.config.whatsapp}?text=${encodeURIComponent(mensaje)}`;
  window.open(url, '_blank', 'noopener');
}

// ---------------- Modales ----------------
function abrirModal(id) {
  $('#' + id).hidden = false;
  document.body.style.overflow = 'hidden';
}
function cerrarModal(id) {
  $('#' + id).hidden = true;
  if (!$$('.modal').some((m) => !m.hidden)) document.body.style.overflow = '';
}

function abrirDetalle(libro) {
  estado.libroAbierto = libro;
  $('#detalleImagen').src = libro.imagen_url || 'img/covers/sin-imagen.svg';
  $('#detalleImagen').onerror = function () { this.src = 'img/covers/sin-imagen.svg'; };
  $('#detalleTitulo').textContent = libro.titulo;
  $('#detalleAutor').textContent = libro.autor || 'Sin autor';
  $('#detallePrecio').textContent = formatearPrecio(libro.precio);
  $('#detalleDescripcion').textContent = libro.descripcion || 'Sin descripción disponible.';
  $('#detalleStock').textContent =
    libro.stock > 0 ? `✓ En stock (${libro.stock} unidades disponibles)` : '✗ Agotado por el momento';
  $('#btnDetalleAgregar').disabled = libro.stock <= 0;
  abrirModal('modalLibro');
}

// ---------------- Formulario de pedido ----------------
function abrirFormularioPedido() {
  if (!estado.carrito.length) {
    toast('Tu carrito está vacío. Agregá libros primero.', 'error');
    return;
  }
  cerrarCarrito();

  $('#pedidoResumen').innerHTML =
    `<ul>` +
    estado.carrito
      .map(
        (i) =>
          `<li><span>${escapeHtml(i.titulo)} x${i.cantidad}</span><span>${formatearPrecio(
            i.precio * i.cantidad
          )}</span></li>`
      )
      .join('') +
    `</ul><div class="total"><span>Total</span><span>${formatearPrecio(totalCarrito())}</span></div>`;

  $('#pedidoContenido').hidden = false;
  $('#pedidoExito').hidden = true;
  $('#erroresPedido').hidden = true;
  abrirModal('modalPedido');
}

function validarFormulario(form) {
  const errores = [];
  const datos = Object.fromEntries(new FormData(form).entries());

  if (!datos.nombre || datos.nombre.trim().length < 3) errores.push('Ingresá tu nombre y apellido.');
  if (!datos.telefono || datos.telefono.replace(/\D/g, '').length < 6) errores.push('Ingresá un teléfono válido.');
  if (datos.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(datos.email)) errores.push('El email no es válido.');

  // marcar campos
  form.querySelectorAll('input, textarea').forEach((c) => c.classList.remove('invalido'));
  if (errores.length) {
    if (!datos.nombre || datos.nombre.trim().length < 3) form.nombre.classList.add('invalido');
    if (!datos.telefono || datos.telefono.replace(/\D/g, '').length < 6) form.telefono.classList.add('invalido');
    if (datos.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(datos.email)) form.email.classList.add('invalido');
  }

  return { datos, errores };
}

async function enviarPedido(evento) {
  evento.preventDefault();
  const form = evento.target;
  const { datos, errores } = validarFormulario(form);

  const cajaErrores = $('#erroresPedido');
  if (errores.length) {
    cajaErrores.innerHTML = `<ul>${errores.map((e) => `<li>${e}</li>`).join('')}</ul>`;
    cajaErrores.hidden = false;
    return;
  }
  cajaErrores.hidden = true;

  const btn = $('#btnEnviarPedido');
  btn.disabled = true;
  btn.textContent = 'Enviando...';

  try {
    const pedido = {
      nombre: datos.nombre.trim(),
      telefono: datos.telefono.trim(),
      email: (datos.email || '').trim(),
      direccion: (datos.direccion || '').trim(),
      comentarios: (datos.comentarios || '').trim(),
      detalles: estado.carrito.map((i) => ({
        id: i.id,
        titulo: i.titulo,
        precio: i.precio,
        cantidad: i.cantidad,
      })),
      total: totalCarrito(),
    };

    await api('/api/pedidos', { method: 'POST', body: JSON.stringify(pedido) });

    // Éxito
    $('#pedidoContenido').hidden = true;
    $('#pedidoExito').hidden = false;
    $('#pedidoExitoTexto').textContent =
      `Gracias ${pedido.nombre.split(' ')[0]}, recibimos tu pedido de ${estado.carrito.length} libro(s). ` +
      `Te contactamos al ${pedido.telefono} para coordinar envío y pago.`;
    $('#btnWhatsappExito').href =
      `https://wa.me/${estado.config.whatsapp}?text=${encodeURIComponent(mensajeCarrito())}`;

    estado.carrito = [];
    guardarCarrito();
    actualizarContadorCarrito();
    renderizarCarrito();
    form.reset();
    toast('¡Pedido enviado correctamente! ✅', 'exito');
  } catch (e) {
    cajaErrores.innerHTML = `<ul><li>${escapeHtml(e.message)}</li></ul>`;
    cajaErrores.hidden = false;
    toast(e.message, 'error');
  } finally {
    btn.disabled = false;
    btn.textContent = 'Enviar pedido';
  }
}

// ---------------- Eventos ----------------
function manejarClicksCatalogo(evento) {
  const destino = evento.target.closest('[data-accion]');
  if (!destino) return;
  const libro = estado.libros.find((l) => l.id === destino.dataset.id);
  if (!libro) return;

  switch (destino.dataset.accion) {
    case 'detalle':
      abrirDetalle(libro);
      break;
    case 'agregar':
      agregarAlCarrito(libro);
      break;
    case 'whatsapp':
      abrirWhatsApp(mensajeLibro(libro));
      break;
  }
}

function init() {
  $('#anio').textContent = new Date().getFullYear();

  cargarConfig();
  cargarLibros();
  cargarCarrito();

  // Catálogo
  $('#gridLibros').addEventListener('click', manejarClicksCatalogo);
  $('#buscador').addEventListener('input', (e) => {
    estado.busqueda = e.target.value;
    renderizarLibros();
  });
  $('#orden').addEventListener('change', (e) => {
    estado.orden = e.target.value;
    renderizarLibros();
  });

  // Carrito
  $('#btnCarrito').addEventListener('click', abrirCarrito);
  $('#btnCerrarCarrito').addEventListener('click', cerrarCarrito);
  $('#overlayCarrito').addEventListener('click', cerrarCarrito);
  $('#cuerpoCarrito').addEventListener('click', (e) => {
    const btn = e.target.closest('[data-carrito]');
    if (!btn) return;
    const { carrito, id } = btn.dataset;
    if (carrito === 'mas') cambiarCantidad(id, 1);
    if (carrito === 'menos') cambiarCantidad(id, -1);
    if (carrito === 'quitar') quitarDelCarrito(id);
  });

  // Opciones de compra desde el carrito
  $('#btnIrPedido').addEventListener('click', abrirFormularioPedido);
  $('#btnWhatsappCarrito').addEventListener('click', () => {
    if (!estado.carrito.length) return toast('Tu carrito está vacío', 'error');
    abrirWhatsApp(mensajeCarrito());
  });

  // Detalle del libro
  $('#btnDetalleAgregar').addEventListener('click', () => {
    if (estado.libroAbierto) {
      agregarAlCarrito(estado.libroAbierto);
      cerrarModal('modalLibro');
    }
  });
  $('#btnDetalleWhatsapp').addEventListener('click', () => {
    if (estado.libroAbierto) abrirWhatsApp(mensajeLibro(estado.libroAbierto));
  });

  // Formulario de pedido
  $('#formPedido').addEventListener('submit', enviarPedido);
  $('#btnWhatsappFormulario').addEventListener('click', () => {
    if (!estado.carrito.length) return toast('Tu carrito está vacío', 'error');
    abrirWhatsApp(mensajeCarrito());
  });

  // Cerrar modales
  $$('[data-cerrar]').forEach((btn) =>
    btn.addEventListener('click', () => cerrarModal(btn.dataset.cerrar))
  );
  $$('.modal').forEach((modal) =>
    modal.addEventListener('click', (e) => {
      if (e.target === modal) cerrarModal(modal.id);
    })
  );
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') $$('.modal').forEach((m) => { if (!m.hidden) cerrarModal(m.id); });
  });

  // Menú móvil
  $('#btnMenu').addEventListener('click', () => $('#nav').classList.toggle('abierto'));
  $$('.nav__enlace').forEach((a) => a.addEventListener('click', () => $('#nav').classList.remove('abierto')));
}

document.addEventListener('DOMContentLoaded', init);

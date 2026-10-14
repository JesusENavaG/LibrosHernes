/* ============================================================
   LibrosHernes - Panel de administración (CRUD de libros)
   ============================================================ */

const CLAVE_TOKEN = 'tokenAdminLibrosHernes';

const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => document.querySelectorAll(sel);

const escapeHtml = (str = '') =>
  String(str).replace(/[&<>"']/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

const formatearPrecio = (n) =>
  new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 }).format(n);

function toast(mensaje, tipo = '') {
  const el = $('#toast');
  el.textContent = mensaje;
  el.className = 'toast ' + (tipo ? `toast--${tipo}` : '');
  el.hidden = false;
  clearTimeout(el._timer);
  el._timer = setTimeout(() => { el.hidden = true; }, 3000);
}

function token() {
  return sessionStorage.getItem(CLAVE_TOKEN) || '';
}

async function api(ruta, opciones = {}) {
  const headers = { ...(opciones.headers || {}) };
  if (!(opciones.body instanceof FormData)) headers['Content-Type'] = 'application/json';
  if (token()) headers['Authorization'] = `Bearer ${token()}`;

  const res = await fetch(ruta, { ...opciones, headers });
  const data = await res.json().catch(() => ({}));

  if (res.status === 401) {
    mostrarLogin();
    throw new Error(data.error || 'Sesión expirada');
  }
  if (!res.ok) throw new Error(data.error || 'Error de conexión');
  return data;
}

// ---------------- Login ----------------
function mostrarLogin() {
  sessionStorage.removeItem(CLAVE_TOKEN);
  $('#vistaLogin').hidden = false;
  $('#vistaPanel').hidden = true;
}

function mostrarPanel() {
  $('#vistaLogin').hidden = true;
  $('#vistaPanel').hidden = false;
}

async function login(evento) {
  evento.preventDefault();
  const error = $('#errorLogin');
  error.hidden = true;
  try {
    const data = await api('/api/admin/login', {
      method: 'POST',
      body: JSON.stringify({ password: $('#passwordLogin').value }),
    });
    sessionStorage.setItem(CLAVE_TOKEN, data.token);
    $('#passwordLogin').value = '';
    mostrarPanel();
    iniciarPanel();
  } catch (e) {
    error.innerHTML = `<ul><li>${escapeHtml(e.message)}</li></ul>`;
    error.hidden = false;
  }
}

// ---------------- Estado del panel ----------------
let libros = [];

async function cargarLibros() {
  try {
    const data = await api('/api/admin/libros');
    libros = data.libros || [];
    renderizarLista();

    const estado = $('#estadoBbdd');
    if (data.fuente === 'supabase') {
      estado.textContent = '● Supabase conectado';
      estado.className = 'estado-bbdd estado-bbdd--ok';
    } else {
      estado.textContent = '● Modo demo (sin Supabase)';
      estado.className = 'estado-bbdd estado-bbdd--demo';
    }
  } catch (e) {
    $('#listaLibros').innerHTML = `<p class="vacio">⚠️ ${escapeHtml(e.message)}</p>`;
  }
}

function renderizarLista() {
  const cont = $('#contadorLibros');
  cont.textContent = `(${libros.length})`;

  if (!libros.length) {
    $('#listaLibros').innerHTML = '<p class="vacio">Todavía no hay libros. ¡Cargá el primero! 📚</p>';
    return;
  }

  $('#listaLibros').innerHTML = libros
    .map(
      (l) => `
      <div class="fila-libro">
        <img src="${escapeHtml(l.imagen_url || 'img/covers/sin-imagen.svg')}" alt=""
             onerror="this.src='img/covers/sin-imagen.svg'" />
        <div>
          <h3>${escapeHtml(l.titulo)} ${l.activo ? '' : '<span class="etiqueta-inactiva">OCULTO</span>'}</h3>
          <small>${escapeHtml(l.autor || 'Sin autor')} · Stock: ${l.stock}</small>
          <span class="fila-libro__precio">${formatearPrecio(l.precio)}</span>
        </div>
        <div class="fila-libro__btns">
          <button data-editar="${l.id}">Editar</button>
          <button data-ocultar="${l.id}">${l.activo ? 'Ocultar' : 'Mostrar'}</button>
          <button data-eliminar="${l.id}" style="color:var(--rojo)">Eliminar</button>
        </div>
      </div>`
    )
    .join('');
}

// ---------------- Alta / edición ----------------
function libroEnFormulario() {
  const form = $('#formLibro');
  return {
    id: form.id.value,
    titulo: form.titulo.value.trim(),
    autor: form.autor.value.trim(),
    descripcion: form.descripcion.value.trim(),
    precio: parseFloat(form.precio.value) || 0,
    stock: parseInt(form.stock.value, 10) || 0,
    imagen_url: form.imagen_url.value.trim(),
    activo: form.activo.checked,
  };
}

function editarLibro(id) {
  const libro = libros.find((l) => l.id === id);
  if (!libro) return;
  const form = $('#formLibro');
  form.id.value = libro.id;
  form.titulo.value = libro.titulo;
  form.autor.value = libro.autor || '';
  form.descripcion.value = libro.descripcion || '';
  form.precio.value = libro.precio;
  form.stock.value = libro.stock;
  form.imagen_url.value = libro.imagen_url || '';
  form.activo.checked = libro.activo;

  $('#tituloForm').textContent = 'Editar libro';
  $('#btnGuardar').textContent = 'Guardar cambios';
  $('#btnCancelar').hidden = false;
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function cancelarEdicion() {
  const form = $('#formLibro');
  form.reset();
  form.id.value = '';
  form.activo.checked = true;
  $('#tituloForm').textContent = 'Agregar libro';
  $('#btnGuardar').textContent = 'Guardar libro';
  $('#btnCancelar').hidden = true;
  $('#vistaPrevia').hidden = true;
  $('#errorLibro').hidden = true;
}

async function guardarLibro(evento) {
  evento.preventDefault();
  const datos = libroEnFormulario();
  const cajaError = $('#errorLibro');
  cajaError.hidden = true;

  if (!datos.titulo) {
    cajaError.innerHTML = '<ul><li>El título es obligatorio</li></ul>';
    cajaError.hidden = false;
    return;
  }

  const btn = $('#btnGuardar');
  btn.disabled = true;

  try {
    let libroGuardado;
    if (datos.id) {
      const r = await api(`/api/admin/libros/${datos.id}`, {
        method: 'PUT',
        body: JSON.stringify(datos),
      });
      libroGuardado = r.libro;
      toast('Libro actualizado ✅', 'exito');
    } else {
      const r = await api('/api/admin/libros', {
        method: 'POST',
        body: JSON.stringify(datos),
      });
      libroGuardado = r.libro;
      toast('Libro creado ✅', 'exito');
    }

    // Subir imagen si se seleccionó un archivo
    const archivo = $('#archivoImagen').files[0];
    if (archivo && libroGuardado) {
      const fd = new FormData();
      fd.append('imagen', archivo);
      try {
        const rImg = await api(`/api/admin/libros/${libroGuardado.id}/imagen`, {
          method: 'POST',
          body: fd,
        });
        toast('Imagen subida a Supabase Storage 🖼️', 'exito');
      } catch (eImg) {
        toast('Imagen no subida: ' + eImg.message, 'error');
      }
    }

    cancelarEdicion();
    await cargarLibros();
  } catch (e) {
    cajaError.innerHTML = `<ul><li>${escapeHtml(e.message)}</li></ul>`;
    cajaError.hidden = false;
    toast(e.message, 'error');
  } finally {
    btn.disabled = false;
  }
}

// ---------------- Ocultar / eliminar ----------------
async function alternarVisibilidad(id) {
  const libro = libros.find((l) => l.id === id);
  if (!libro) return;
  try {
    await api(`/api/admin/libros/${id}`, {
      method: 'PUT',
      body: JSON.stringify({ ...libro, activo: !libro.activo }),
    });
    toast(libro.activo ? 'Libro oculto de la tienda' : 'Libro visible en la tienda ✅', 'exito');
    await cargarLibros();
  } catch (e) {
    toast(e.message, 'error');
  }
}

async function eliminarLibro(id) {
  const libro = libros.find((l) => l.id === id);
  if (!libro) return;
  if (!confirm(`¿Eliminar "${libro.titulo}"? Esta acción no se puede deshacer.`)) return;
  try {
    await api(`/api/admin/libros/${id}`, { method: 'DELETE' });
    toast('Libro eliminado 🗑️');
    await cargarLibros();
  } catch (e) {
    toast(e.message, 'error');
  }
}

// ---------------- Vista previa de imagen ----------------
function previsualizarImagen() {
  const archivo = $('#archivoImagen').files[0];
  const previa = $('#vistaPrevia');
  if (!archivo) {
    previa.hidden = true;
    return;
  }
  previa.src = URL.createObjectURL(archivo);
  previa.hidden = false;
}

// ---------------- Init ----------------
function iniciarPanel() {
  cargarLibros();
}

function init() {
  $('#formLogin').addEventListener('submit', login);
  $('#formLibro').addEventListener('submit', guardarLibro);
  $('#btnCancelar').addEventListener('click', cancelarEdicion);
  $('#archivoImagen').addEventListener('change', previsualizarImagen);
  $('#btnSalir').addEventListener('click', mostrarLogin);

  $('#listaLibros').addEventListener('click', (e) => {
    const btn = e.target.closest('button');
    if (!btn) return;
    if (btn.dataset.editar) editarLibro(btn.dataset.editar);
    if (btn.dataset.ocultar) alternarVisibilidad(btn.dataset.ocultar);
    if (btn.dataset.eliminar) eliminarLibro(btn.dataset.eliminar);
  });

  // Si ya hay token, entrar directo al panel
  if (token()) {
    mostrarPanel();
    iniciarPanel();
  }
}

document.addEventListener('DOMContentLoaded', init);

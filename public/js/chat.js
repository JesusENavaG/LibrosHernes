/* ============================================================
   LibrosHernes - Chat con el Buhito Sabio 🦉
   Front del chat: historial, typing, sugerencias y contexto
   del libro desde el que se abrió la conversación.
   ============================================================ */

const $ = (sel) => document.querySelector(sel);

const estado = {
  historial: [],     // [{ role: 'user'|'assistant', texto }] para mantener el hilo
  libro: null,       // libro desde el que se abrió el chat (?libro=id)
  esperando: false,
  whatsapp: '5491173667668',
};

const SUGERENCIAS_GENERICAS = [
  '¿Qué libros tienen en stock?',
  'Recomendame algo para regalar',
  '¿Cómo es el envío?',
  'Contame sobre Cien años de soledad',
];

// ---------------- Utilidades ----------------
function crearMensaje(role, texto) {
  const envoltorio = document.createElement('div');
  envoltorio.className = `mensaje mensaje--${role === 'user' ? 'cliente' : 'buho'}`;

  if (role !== 'user') {
    const avatar = document.createElement('img');
    avatar.src = 'img/buho.svg';
    avatar.alt = '';
    avatar.className = 'mensaje__avatar';
    envoltorio.appendChild(avatar);
  }

  const burbuja = document.createElement('div');
  burbuja.className = 'mensaje__burbuja';
  burbuja.textContent = texto; // textContent: la IA nunca inyecta HTML
  envoltorio.appendChild(burbuja);

  agregarAlCuerpo(envoltorio);
  return envoltorio;
}

function crearEscribiendo() {
  const envoltorio = document.createElement('div');
  envoltorio.className = 'mensaje mensaje--buho';
  envoltorio.id = 'escribiendoBuho';

  const avatar = document.createElement('img');
  avatar.src = 'img/buho.svg';
  avatar.alt = '';
  avatar.className = 'mensaje__avatar';

  const puntos = document.createElement('div');
  puntos.className = 'escribiendo';
  puntos.innerHTML = '<span></span><span></span><span></span>';

  envoltorio.append(avatar, puntos);
  agregarAlCuerpo(envoltorio);
  return envoltorio;
}

function quitarEscribiendo() {
  const el = $('#escribiendoBuho');
  if (el) el.remove();
}

function agregarAlCuerpo(nodo) {
  const cuerpo = $('#mensajes');
  cuerpo.appendChild(nodo);
  cuerpo.scrollTop = cuerpo.scrollHeight;
}

// ---------------- Ficha del libro ----------------
async function cargarContextoLibro(id) {
  try {
    const res = await fetch(`/api/libros/${encodeURIComponent(id)}`);
    if (!res.ok) return;
    const data = await res.json();
    const libro = data.libro;
    if (!libro) return;

    estado.libro = libro;
    $('#contextoImg').src = libro.imagen_url || 'img/covers/sin-imagen.svg';
    $('#contextoImg').onerror = function () { this.src = 'img/covers/sin-imagen.svg'; };
    $('#contextoTitulo').textContent = libro.titulo;
    $('#contextoPrecio').textContent = libro.autor ? `${libro.autor} · $${libro.precio}` : `$${libro.precio}`;
    $('#contextoLibro').hidden = false;
  } catch {
    // Sin backend: el chat igual funciona con el endpoint cuando vuelva
  }
}

// ---------------- Configuración (WhatsApp) ----------------
async function cargarConfig() {
  try {
    const res = await fetch('/api/config');
    if (!res.ok) return;
    const cfg = await res.json();
    if (cfg.whatsapp) estado.whatsapp = cfg.whatsapp;
    const btn = $('#btnWhatsapp');
    btn.href = `https://wa.me/${estado.whatsapp}?text=${encodeURIComponent('¡Hola LibrosHernes! Vengo del chat del Buhito Sabio 🦉')}`;
  } catch {
    // Se usa el número por defecto
  }
}

// ---------------- Saludo inicial ----------------
function saludoInicial() {
  if (estado.libro) {
    return (
      `¡Hola! 🦉✨ Soy el Buhito Sabio, el guardián de LibrosHernes.\n\n` +
      `Veo que estás mirando «${estado.libro.titulo}». Preguntame por su precio, stock y disponibilidad, ` +
      `o pedime que te cuente una descripción más completa ✨\n\n` +
      `¿En qué te ayudo?`
    );
  }
  return (
    `¡Hola! 🦉✨ Soy el Buhito Sabio, el guardián de la librería LibrosHernes.\n\n` +
    `Conozco todo nuestro catálogo: puedo decirte precios, stock y disponibilidad de cualquier libro, ` +
    `o recomendarte algo según lo que busques 📚\n\n` +
    `¿Qué querés saber?`
  );
}

function sugerenciasSegunContexto() {
  if (estado.libro) {
    return [
      `¿Cuál es el precio de ${estado.libro.titulo}?`,
      `¿Hay stock de ${estado.libro.titulo}?`,
      'Contame una descripción del libro (de internet)',
      'Recomendame algo parecido',
    ];
  }
  return SUGERENCIAS_GENERICAS;
}

function pintarSugerencias() {
  const cont = $('#sugerencias');
  cont.innerHTML = '';
  sugerenciasSegunContexto().forEach((texto) => {
    const chip = document.createElement('button');
    chip.type = 'button';
    chip.className = 'chip';
    chip.textContent = texto;
    chip.addEventListener('click', () => enviarMensaje(texto));
    cont.appendChild(chip);
  });
}

// ---------------- Envío ----------------
async function enviarMensaje(textoForzado) {
  const input = $('#inputMensaje');
  const texto = (textoForzado || input.value).trim();
  if (!texto || estado.esperando) return;

  estado.esperando = true;
  $('#btnEnviar').disabled = true;
  if (!textoForzado) input.value = '';
  input.style.height = 'auto';
  ocultarSugerencias();

  crearMensaje('user', texto);
  crearEscribiendo();

  try {
    const res = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        mensaje: texto,
        historial: estado.historial.slice(-10),
        libro_id: estado.libro ? estado.libro.id : null,
      }),
    });

    const datos = await res.json().catch(() => ({}));

    if (!res.ok) {
      throw new Error(datos.error || 'No pude responder ahora. Probá de nuevo en unos segundos.');
    }

    estado.historial.push({ role: 'user', texto });
    estado.historial.push({ role: 'assistant', texto: datos.respuesta });
    // cortamos el hilo para no crecer sin límite
    if (estado.historial.length > 20) estado.historial = estado.historial.slice(-20);

    crearMensaje('assistant', datos.respuesta);
  } catch (e) {
    crearMensaje(
      'assistant',
      `Ups 🦉… ${e.message}\n\nSi seguís con el problema, escribinos directo por WhatsApp y te ayudamos 📚`
    );
  } finally {
    quitarEscribiendo();
    estado.esperando = false;
    $('#btnEnviar').disabled = false;
    input.focus();
  }
}

function ocultarSugerencias() {
  const cont = $('#sugerencias');
  if (cont.children.length) cont.innerHTML = '';
}

// ---------------- Init ----------------
function init() {
  const params = new URLSearchParams(location.search);
  const idLibro = params.get('libro');

  // Placeholder más corto en pantallas chicas
  const input = $('#inputMensaje');
  if (window.innerWidth < 520) input.placeholder = 'Preguntale al búho…';

  cargarConfig();
  pintarSugerencias();

  if (idLibro) {
    cargarContextoLibro(idLibro).finally(() => {
      crearMensaje('assistant', saludoInicial());
    });
  } else {
    crearMensaje('assistant', saludoInicial());
  }

  $('#formChat').addEventListener('submit', (e) => {
    e.preventDefault();
    enviarMensaje();
  });

  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      enviarMensaje();
    }
  });
  input.addEventListener('input', () => {
    input.style.height = 'auto';
    input.style.height = Math.min(input.scrollHeight, 120) + 'px';
  });
}

document.addEventListener('DOMContentLoaded', init);

/* ============================================================
   LibrosHernes - Chat flotante del Buhito Sabio 🦉
   Se abre superpuesto sobre la tienda (no abre otra ventana).
   - La página sigue pudiendo scrollear mientras el chat está abierto.
   - La conversación se conserva al cerrar y volver a abrir.
   ============================================================ */
(function () {
  'use strict';

  const CLAVE_HISTORIAL = 'buhitoHistorialLibrosHernes';

  const $id = (id) => document.getElementById(id);

  const estado = {
    historial: [],   // [{ role: 'user'|'assistant', texto }]
    libro: null,     // libro sobre el que está consultando (si se abrió desde una ficha)
    esperando: false,
    whatsapp: '5491173667668',
    saludoPintado: false,
  };

  const SUGERENCIAS_GENERICAS = [
    '¿Qué libros tienen en stock?',
    'Recomendame algo para regalar',
    '¿Cómo es el envío?',
    'Contame sobre Cien años de soledad',
  ];

  // ---------------- Persistencia (conservar al cerrar) ----------------
  function guardarHistorial() {
    try {
      sessionStorage.setItem(CLAVE_HISTORIAL, JSON.stringify(estado.historial.slice(-20)));
    } catch { /* modo privado: se conserva solo en memoria */ }
  }

  function recuperarHistorial() {
    try {
      const crudo = sessionStorage.getItem(CLAVE_HISTORIAL);
      const lista = crudo ? JSON.parse(crudo) : [];
      return Array.isArray(lista) ? lista : [];
    } catch {
      return [];
    }
  }

  // ---------------- Utilidades ----------------
  function crearMensaje(role, texto, sinAnimacion) {
    const envoltorio = document.createElement('div');
    envoltorio.className = `mensaje mensaje--${role === 'user' ? 'cliente' : 'buho'}`;
    if (sinAnimacion) envoltorio.style.animation = 'none';

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
    quitarEscribiendo();
    const envoltorio = document.createElement('div');
    envoltorio.className = 'mensaje mensaje--buho';
    envoltorio.id = 'buhitoEscribiendo';

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
    const el = $id('buhitoEscribiendo');
    if (el) el.remove();
  }

  function agregarAlCuerpo(nodo) {
    const cuerpo = $id('buhitoMensajes');
    cuerpo.appendChild(nodo);
    cuerpo.scrollTop = cuerpo.scrollHeight;
  }

  // ---------------- Saludo y sugerencias ----------------
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
        'Contame una descripción del libro',
        'Recomendame algo parecido',
      ];
    }
    return SUGERENCIAS_GENERICAS;
  }

  function pintarSugerencias() {
    const cont = $id('buhitoSugerencias');
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

  function ocultarSugerencias() {
    const cont = $id('buhitoSugerencias');
    if (cont.children.length) cont.innerHTML = '';
  }

  // ---------------- Ficha del libro ----------------
  function pintarContexto(libro) {
    estado.libro = libro;
    if (!libro) {
      $id('buhitoContexto').hidden = true;
      pintarSugerencias();
      return;
    }
    const img = $id('buhitoContextoImg');
    img.src = libro.imagen_url || 'img/covers/sin-imagen.svg';
    img.onerror = function () { this.src = 'img/covers/sin-imagen.svg'; };
    $id('buhitoContextoTitulo').textContent = libro.titulo;
    $id('buhitoContextoPrecio').textContent = libro.autor
      ? `${libro.autor} · $${Number(libro.precio || 0).toLocaleString('es-AR')}`
      : `$${Number(libro.precio || 0).toLocaleString('es-AR')}`;
    $id('buhitoContexto').hidden = false;
    pintarSugerencias();
    // El panel de contexto achica la zona de mensajes: volvemos al final
    const cuerpo = $id('buhitoMensajes');
    requestAnimationFrame(() => { cuerpo.scrollTop = cuerpo.scrollHeight; });
  }

  async function cargarLibroPorId(id) {
    try {
      const res = await fetch(`/api/libros/${encodeURIComponent(id)}`);
      if (!res.ok) return;
      const data = await res.json();
      if (data.libro) pintarContexto(data.libro);
    } catch {
      // Sin backend el chat igual funciona cuando vuelve la API
    }
  }

  // ---------------- WhatsApp ----------------
  function pintarWhatsApp() {
    const a = $id('buhitoWhatsapp');
    if (a) {
      a.href = `https://wa.me/${estado.whatsapp}?text=${encodeURIComponent('¡Hola LibrosHernes! Vengo del chat del Buhito Sabio 🦉')}`;
    }
  }

  async function cargarConfig() {
    try {
      const res = await fetch('/api/config');
      if (!res.ok) return;
      const cfg = await res.json();
      if (cfg.whatsapp) estado.whatsapp = cfg.whatsapp;
      pintarWhatsApp();
    } catch {
      // Se usa el número por defecto
    }
  }

  // ---------------- Envío ----------------
  async function enviarMensaje(textoForzado) {
    const input = $id('buhitoInput');
    const texto = (textoForzado || input.value).trim();
    if (!texto || estado.esperando) return;

    estado.esperando = true;
    $id('buhitoEnviar').disabled = true;
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
      if (estado.historial.length > 20) estado.historial = estado.historial.slice(-20);
      guardarHistorial();

      crearMensaje('assistant', datos.respuesta);
    } catch (e) {
      crearMensaje(
        'assistant',
        `Ups 🦉… ${e.message}\n\nSi seguís con el problema, escribinos directo por WhatsApp y te ayudamos 📚`
      );
    } finally {
      quitarEscribiendo();
      estado.esperando = false;
      $id('buhitoEnviar').disabled = false;
      input.focus();
    }
  }

  // ---------------- Abrir / cerrar ----------------
  function estaAbierto() {
    return !$id('buhitoWidget').hidden;
  }

  function abrir() {
    if (estaAbierto()) return;
    $id('buhitoWidget').hidden = false;
    $id('btnBuhoFab').hidden = true;

    // Primer mensaje: saludo, o la conversación que venía antes
    if (!estado.saludoPintado) {
      estado.saludoPintado = true;
      if (estado.historial.length) {
        estado.historial.forEach((m) => crearMensaje(m.role, m.texto, true));
      } else {
        crearMensaje('assistant', saludoInicial());
      }
      pintarSugerencias();
    }

    setTimeout(() => $id('buhitoInput').focus(), 60);
  }

  function cerrar() {
    $id('buhitoWidget').hidden = true;
    $id('btnBuhoFab').hidden = false;
  }

  // API para el resto de la página (botones "Consultar al búho")
  window.abrirBuhito = function (libroOId) {
    if (libroOId && typeof libroOId === 'object') {
      pintarContexto(libroOId);
    } else if (libroOId) {
      cargarLibroPorId(libroOId);
    }
    abrir();
  };

  window.cerrarBuhito = cerrar;

  // ---------------- Init ----------------
  function init() {
    estado.historial = recuperarHistorial();

    pintarWhatsApp();
    cargarConfig();

    const input = $id('buhitoInput');
    if (window.innerWidth < 520) input.placeholder = 'Preguntale al búho…';

    $id('btnBuhoFab').addEventListener('click', abrir);
    $id('btnBuhitoCerrar').addEventListener('click', cerrar);

    $id('buhitoForm').addEventListener('submit', (e) => {
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
      input.style.height = Math.min(input.scrollHeight, 110) + 'px';
    });

    // ESC cierra el chat (y no molesta si se está escribiendo)
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && estaAbierto()) cerrar();
    });

    // Enlaces directos: /?chat=1 o /?libro=<id>
    const params = new URLSearchParams(location.search);
    if (params.get('libro')) cargarLibroPorId(params.get('libro'));
    if (params.get('chat') === '1' || params.get('libro')) abrir();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();

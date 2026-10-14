// ============================================================
//  LibrosHernes - Capa de datos
//
//  Unifica el acceso a la base de datos: usa el cliente de
//  Supabase (service role) si está configurado; si no, la
//  conexión directa a PostgreSQL (DATABASE_URL).
//
//  Todas las funciones devuelven los mismos campos que la
//  tabla, con los números ya convertidos.
// ============================================================
const { createClient } = require('@supabase/supabase-js');
const { Pool } = require('pg');

const SUPABASE_URL = process.env.SUPABASE_URL || '';
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const TABLA_LIBROS = process.env.TABLA_LIBROS || 'libros';
const TABLA_PEDIDOS = process.env.TABLA_PEDIDOS || 'pedidos';

// Cliente Supabase con permisos de escritura (solo backend)
const supabase =
  SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY
    ? createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
        auth: { persistSession: false, autoRefreshToken: false },
      })
    : null;

// Conexión directa a PostgreSQL (Supabase pooler o local)
const pool = process.env.DATABASE_URL
  ? new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: { rejectUnauthorized: false },
      max: 5,
    })
  : null;

// Qué motor se está usando (para mostrarlo en /api/health)
const fuente = () => (supabase ? 'supabase' : pool ? 'postgres' : 'demo');
const hayConexion = () => Boolean(supabase || pool);

// Normaliza una fila de la tabla 'libros'
const normalizarLibro = (l) => ({
  id: l.id,
  titulo: l.titulo,
  autor: l.autor || '',
  descripcion: l.descripcion || '',
  precio: Number(l.precio) || 0,
  imagen_url: l.imagen_url || '',
  stock: Number(l.stock) || 0,
  activo: l.activo !== false,
});

// ------------------------------------------------------------
//  LIBROS
// ------------------------------------------------------------
async function listarLibros({ soloActivos = false } = {}) {
  if (supabase) {
    let q = supabase.from(TABLA_LIBROS).select('*');
    if (soloActivos) q = q.eq('activo', true);
    const { data, error } = await q.order('created_at', { ascending: false });
    if (error) throw error;
    return (data || []).map(normalizarLibro);
  }
  const where = soloActivos ? 'where activo = true' : '';
  const { rows } = await pool.query(
    `select * from ${TABLA_LIBROS} ${where} order by created_at desc`
  );
  return rows.map(normalizarLibro);
}

async function obtenerLibro(id) {
  if (supabase) {
    const { data, error } = await supabase
      .from(TABLA_LIBROS).select('*').eq('id', id).maybeSingle();
    if (error) throw error;
    return data ? normalizarLibro(data) : null;
  }
  const { rows } = await pool.query(`select * from ${TABLA_LIBROS} where id = $1`, [id]);
  return rows[0] ? normalizarLibro(rows[0]) : null;
}

async function crearLibro(libro) {
  if (supabase) {
    const { data, error } = await supabase
      .from(TABLA_LIBROS).insert(libro).select('*').single();
    if (error) throw error;
    return normalizarLibro(data);
  }
  const { rows } = await pool.query(
    `insert into ${TABLA_LIBROS} (titulo, autor, descripcion, precio, imagen_url, stock, activo)
     values ($1, $2, $3, $4, $5, $6, $7) returning *`,
    [libro.titulo, libro.autor, libro.descripcion, libro.precio,
     libro.imagen_url, libro.stock, libro.activo]
  );
  return normalizarLibro(rows[0]);
}

async function editarLibro(id, libro) {
  if (supabase) {
    const { data, error } = await supabase
      .from(TABLA_LIBROS).update(libro).eq('id', id).select('*').maybeSingle();
    if (error) throw error;
    return data ? normalizarLibro(data) : null;
  }
  const { rows } = await pool.query(
    `update ${TABLA_LIBROS}
        set titulo = $1, autor = $2, descripcion = $3, precio = $4,
            imagen_url = $5, stock = $6, activo = $7, updated_at = now()
      where id = $8 returning *`,
    [libro.titulo, libro.autor, libro.descripcion, libro.precio,
     libro.imagen_url, libro.stock, libro.activo, id]
  );
  return rows[0] ? normalizarLibro(rows[0]) : null;
}

async function borrarLibro(id) {
  if (supabase) {
    const { error } = await supabase.from(TABLA_LIBROS).delete().eq('id', id);
    if (error) throw error;
    return true;
  }
  const r = await pool.query(`delete from ${TABLA_LIBROS} where id = $1`, [id]);
  return r.rowCount > 0;
}

async function actualizarImagen(id, url) {
  if (supabase) {
    const { error } = await supabase
      .from(TABLA_LIBROS).update({ imagen_url: url, updated_at: new Date().toISOString() })
      .eq('id', id);
    if (error) throw error;
    return true;
  }
  await pool.query(
    `update ${TABLA_LIBROS} set imagen_url = $1, updated_at = now() where id = $2`,
    [url, id]
  );
  return true;
}

// ------------------------------------------------------------
//  PEDIDOS
// ------------------------------------------------------------
async function crearPedido(pedido) {
  if (supabase) {
    const { data, error } = await supabase
      .from(TABLA_PEDIDOS).insert(pedido).select('id').single();
    if (error) throw error;
    return data.id;
  }
  const { rows } = await pool.query(
    `insert into ${TABLA_PEDIDOS} (nombre, telefono, email, direccion, comentarios, detalles, total, estado)
     values ($1, $2, $3, $4, $5, $6, $7, $8) returning id`,
    [pedido.nombre, pedido.telefono, pedido.email, pedido.direccion,
     pedido.comentarios, JSON.stringify(pedido.detalles), pedido.total, pedido.estado]
  );
  return rows[0].id;
}

module.exports = {
  supabase,
  pool,
  fuente,
  hayConexion,
  normalizarLibro,
  listarLibros,
  obtenerLibro,
  crearLibro,
  editarLibro,
  borrarLibro,
  actualizarImagen,
  crearPedido,
};

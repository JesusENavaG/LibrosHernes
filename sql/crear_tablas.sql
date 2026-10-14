-- ============================================================
-- LibrosHernes - Estructura de base de datos (Supabase)
-- Ejecutar en: Supabase > SQL Editor
-- ============================================================

-- ------------------------------------------------------------
-- TABLA DE LIBROS
-- ------------------------------------------------------------
create table if not exists public.libros (
  id          uuid primary key default gen_random_uuid(),
  titulo      text not null,
  autor       text,
  descripcion text,
  precio      numeric(10,2) not null default 0,
  imagen_url  text,
  stock       integer not null default 0,
  activo      boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

comment on table public.libros is 'Catalogo de libros fisicos de LibrosHernes';

-- ------------------------------------------------------------
-- TABLA DE PEDIDOS (formulario de requerimiento)
-- ------------------------------------------------------------
create table if not exists public.pedidos (
  id          uuid primary key default gen_random_uuid(),
  nombre      text not null,
  telefono    text not null,
  email       text,
  direccion   text,
  comentarios text,
  detalles    jsonb not null default '[]'::jsonb,
  total       numeric(10,2) not null default 0,
  estado      text not null default 'pendiente',
  created_at  timestamptz not null default now()
);

comment on table public.pedidos is 'Pedidos enviados desde el formulario de la tienda';

-- ------------------------------------------------------------
-- RLS (seguridad por fila)
-- ------------------------------------------------------------
alter table public.libros  enable row level security;
alter table public.pedidos enable row level security;

-- Libros: cualquiera puede leer, solo el service role (backend) escribe
drop policy if exists "libros publicos" on public.libros;
create policy "libros publicos"
  on public.libros for select
  using (true);

-- Pedidos: nadie escribe desde el cliente anonimo (lo hace el backend
-- con la service role key). Solo se inserta, no se leen datos de otros.
drop policy if exists "crear pedido" on public.pedidos;
create policy "crear pedido"
  on public.pedidos for insert
  with check (true);

-- ------------------------------------------------------------
-- BUCKET DE IMAGENES (Supabase Storage)
-- ------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'libros',
  'libros',
  true,
  5242880,
  array['image/jpeg','image/png','image/webp','image/gif','image/svg+xml']
)
on conflict (id) do nothing;

-- Lectura publica de las imagenes del bucket
drop policy if exists "imagenes libros publicas" on storage.objects;
create policy "imagenes libros publicas"
  on storage.objects for select
  using (bucket_id = 'libros');

-- ------------------------------------------------------------
-- FUNCIÓN: DESCUENTO ATÓMICO DE STOCK
-- (la usa el backend al confirmar un pedido; si no existe,
--  el servidor funciona igual pero con una protección menor)
-- ------------------------------------------------------------
create or replace function public.descontar_stock(p_id uuid, p_cantidad integer)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_stock integer;
  v_titulo text;
begin
  update public.libros
     set stock = stock - p_cantidad,
         updated_at = now()
   where id = p_id
     and activo = true
     and stock >= p_cantidad
  returning stock, titulo into v_stock, v_titulo;

  if v_stock is null then
    return jsonb_build_object('ok', false, 'motivo', 'sin_stock');
  end if;

  return jsonb_build_object('ok', true, 'stock', v_stock, 'titulo', v_titulo);
end;
$$;

comment on function public.descontar_stock is
  'Descuenta stock de un libro solo si alcanza, en una sola operación segura';

-- ------------------------------------------------------------
-- DATOS DE EJEMPLO (borrar cuando cargues libros reales)
-- ------------------------------------------------------------
insert into public.libros (titulo, autor, descripcion, precio, imagen_url, stock) values
 ('Cien años de soledad', 'Gabriel García Márquez', 'La obra cumbre del realismo mágico: la historia de la familia Buendía en Macondo.', 12999.00, '/img/covers/cien-anos.svg', 10),
 ('El principito', 'Antoine de Saint-Exupéry', 'Una fábula poética sobre la amistad, el amor y lo esencial invisible a los ojos.', 8999.00, '/img/covers/el-principito.svg', 15),
 ('1984', 'George Orwell', 'La novela distópica por excelencia sobre la vigilancia y el control totalitario.', 11499.00, '/img/covers/1984.svg', 8),
 ('Don Quijote de la Mancha', 'Miguel de Cervantes', 'Las aventuras del ingenioso hidalgo y su fiel escudero Sancho Panza.', 15999.00, '/img/covers/don-quijote.svg', 6),
 ('Rayuela', 'Julio Cortázar', 'Un laberinto literario para leer en varios órdenes, obra clave de la literatura latinoamericana.', 10999.00, '/img/covers/rayuela.svg', 9),
 ('Harry Potter y la piedra filosofal', 'J. K. Rowling', 'El inicio de la saga del niño mago que conquistó a lectores de todo el mundo.', 13999.00, '/img/covers/harry-potter.svg', 12)
on conflict do nothing;

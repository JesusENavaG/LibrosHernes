-- ============================================================
-- LibrosHernes - Categorías del catálogo
-- Ejecutar en: Supabase > SQL Editor  (SOLO cuando se confirme)
-- ============================================================
-- Agrega la columna 'categoria' a la tabla de libros y crea un
-- índice para que el filtro de la tienda sea rápido.
--
-- Es una migración segura: no borra ni modifica datos existentes.
-- Los libros viejos quedan con categoria = NULL y la tienda los
-- muestra igual (el filtro "Todas las categorías" los incluye).
-- ============================================================

alter table public.libros
  add column if not exists categoria text;

comment on column public.libros.categoria is
  'Categoría del catálogo (Novela, Clásicos, En inglés, ...). Vacío = sin categoría';

-- Índice para filtrar rápido en la tienda
create index if not exists idx_libros_categoria
  on public.libros (categoria);

-- ------------------------------------------------------------
-- (Opcional) Categorías de ejemplo para los libros que ya están
-- publicados. Descomentar y ajustar SOLO si se quiere cargar de
-- una vez. Si no, se asignan desde el panel /admin libro a libro.
-- ------------------------------------------------------------
-- update public.libros set categoria = 'En inglés'
--  where titulo in ('The Firm', 'The Barcelona Game', 'A Little Princess',
--                   'Death on the Nile', 'Voodoo Island', 'Dante''s Peak',
--                   'Meet Me in Istanbul', 'Activity Book Excalibur');

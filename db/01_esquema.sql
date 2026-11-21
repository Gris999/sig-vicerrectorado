-- Esquema de la capa "Oficinas Administrativas del Vicerrectorado (1)" — Grupo 16 · SIG INF442-SA
-- Sistema de referencia: WGS 84 (EPSG:4326). Áreas y longitudes en metros vía geography.
CREATE EXTENSION IF NOT EXISTS postgis;

-- Clasificación de ambientes (dominio controlado)
CREATE TABLE clasificacion (
  codigo      TEXT PRIMARY KEY,
  nombre      TEXT NOT NULL,
  descripcion TEXT
);

CREATE TABLE dependencia (
  id          SERIAL PRIMARY KEY,
  nombre      TEXT NOT NULL,
  sigla       TEXT,
  nivel       SMALLINT NOT NULL,            -- 0 Vicerrectorado · 1 dirección · 2 unidad
  padre_id    INT REFERENCES dependencia(id),
  alcance     TEXT NOT NULL DEFAULT 'seguro' CHECK (alcance IN ('seguro','condicional')),
  responsable TEXT,
  cargo       TEXT
);

-- POLÍGONOS ----------------------------------------------------------------
CREATE TABLE edificio (
  id        SERIAL PRIMARY KEY,
  codigo    TEXT UNIQUE,
  nombre    TEXT NOT NULL,
  uso       TEXT NOT NULL DEFAULT 'ACADEMICO' REFERENCES clasificacion(codigo),
  sede      TEXT NOT NULL DEFAULT 'Ciudad Universitaria',
  nro_pisos SMALLINT,
  area_m2   NUMERIC(12,2),
  fuente    TEXT NOT NULL,
  geom      geometry(Polygon, 4326) NOT NULL CHECK (ST_IsValid(geom))
);

CREATE TABLE zona (                          -- campus, canchas, jardines, parqueos
  id      SERIAL PRIMARY KEY,
  tipo    TEXT NOT NULL CHECK (tipo IN ('campus','cancha','jardin','parqueo')),
  nombre  TEXT,
  detalle TEXT,
  area_m2 NUMERIC(12,2),
  fuente  TEXT NOT NULL,
  geom    geometry(Polygon, 4326) NOT NULL CHECK (ST_IsValid(geom))
);

-- LÍNEAS -------------------------------------------------------------------
CREATE TABLE via (                           -- senderos y vías internas
  id         SERIAL PRIMARY KEY,
  tipo       TEXT NOT NULL CHECK (tipo IN ('sendero','via_interna','escalera')),
  nombre     TEXT,
  superficie TEXT,
  longitud_m NUMERIC(10,2),
  fuente     TEXT NOT NULL,
  geom       geometry(LineString, 4326) NOT NULL
);

-- PUNTOS -------------------------------------------------------------------
CREATE TABLE oficina (
  id                SERIAL PRIMARY KEY,
  codigo            TEXT UNIQUE NOT NULL,     -- 'VR1-001'
  nombre            TEXT NOT NULL,
  sigla             TEXT,
  clasificacion     TEXT NOT NULL REFERENCES clasificacion(codigo),
  funcion           TEXT,
  tramites          TEXT,
  dependencia_id    INT NOT NULL REFERENCES dependencia(id),
  edificio_id       INT REFERENCES edificio(id),
  piso              TEXT,
  responsable       TEXT,
  cargo_responsable TEXT,
  horario           TEXT,
  telefono          TEXT,
  email             TEXT,
  web               TEXT,
  foto              TEXT,
  precision_m       NUMERIC(5,1),
  metodo_captura    TEXT NOT NULL,
  fecha_captura     DATE NOT NULL DEFAULT CURRENT_DATE,
  verificado        BOOLEAN NOT NULL DEFAULT false,
  capa              TEXT NOT NULL DEFAULT 'VICERRECTORADO_1',
  geom              geometry(Point, 4326) NOT NULL
);

CREATE TABLE punto (                         -- entradas, extintores y servicios
  id          SERIAL PRIMARY KEY,
  tipo        TEXT NOT NULL CHECK (tipo IN ('entrada','extintor','servicio')),
  subtipo     TEXT,                          -- porton, puerta, baño, comedor, consultorio…
  nombre      TEXT,
  descripcion TEXT,
  edificio_id INT REFERENCES edificio(id),
  fuente      TEXT NOT NULL,
  fecha       DATE NOT NULL DEFAULT CURRENT_DATE,
  geom        geometry(Point, 4326) NOT NULL
);

CREATE INDEX ON edificio USING GIST (geom);
CREATE INDEX ON zona     USING GIST (geom);
CREATE INDEX ON via      USING GIST (geom);
CREATE INDEX ON oficina  USING GIST (geom);
CREATE INDEX ON punto    USING GIST (geom);

-- Cálculo automático de superficies y longitudes
CREATE FUNCTION calc_area() RETURNS trigger AS $$
BEGIN NEW.area_m2 := round(ST_Area(NEW.geom::geography)::numeric, 2); RETURN NEW; END $$ LANGUAGE plpgsql;
CREATE TRIGGER t_area BEFORE INSERT OR UPDATE OF geom ON edificio FOR EACH ROW EXECUTE FUNCTION calc_area();
CREATE TRIGGER t_area BEFORE INSERT OR UPDATE OF geom ON zona     FOR EACH ROW EXECUTE FUNCTION calc_area();

CREATE FUNCTION calc_long() RETURNS trigger AS $$
BEGIN NEW.longitud_m := round(ST_Length(NEW.geom::geography)::numeric, 2); RETURN NEW; END $$ LANGUAGE plpgsql;
CREATE TRIGGER t_long BEFORE INSERT OR UPDATE OF geom ON via FOR EACH ROW EXECUTE FUNCTION calc_long();

-- Asigna el edificio que contiene a una oficina/punto si no se indicó
CREATE FUNCTION asignar_edificio() RETURNS trigger AS $$
BEGIN
  IF NEW.edificio_id IS NULL THEN
    SELECT e.id INTO NEW.edificio_id FROM edificio e
    WHERE ST_DWithin(e.geom::geography, NEW.geom::geography, 5)
    ORDER BY e.geom <-> NEW.geom LIMIT 1;
  END IF;
  RETURN NEW;
END $$ LANGUAGE plpgsql;
CREATE TRIGGER t_edif BEFORE INSERT OR UPDATE OF geom ON oficina FOR EACH ROW EXECUTE FUNCTION asignar_edificio();
CREATE TRIGGER t_edif BEFORE INSERT OR UPDATE OF geom ON punto   FOR EACH ROW EXECUTE FUNCTION asignar_edificio();

-- Esquema de la capa "Oficinas Administrativas del Vicerrectorado (1)" — Grupo 16
-- Sistema de referencia: WGS 84 (EPSG:4326)
CREATE EXTENSION IF NOT EXISTS postgis;

CREATE TABLE dependencia (
  id        SERIAL PRIMARY KEY,
  nombre    TEXT NOT NULL,
  sigla     TEXT,
  nivel     SMALLINT NOT NULL,              -- 0 = Vicerrectorado, 1 = dirección, 2 = unidad
  padre_id  INT REFERENCES dependencia(id),
  alcance   TEXT NOT NULL DEFAULT 'seguro' CHECK (alcance IN ('seguro','condicional'))
);

CREATE TABLE edificio (
  id        SERIAL PRIMARY KEY,
  codigo    TEXT UNIQUE,                    -- p. ej. 'M-150'
  nombre    TEXT NOT NULL,
  sede      TEXT NOT NULL DEFAULT 'Ciudad Universitaria',
  nro_pisos SMALLINT,
  area_m2   NUMERIC(10,2),
  fuente    TEXT NOT NULL,                  -- 'OSM way 123' / 'Digitalizado'
  geom      geometry(Polygon, 4326) NOT NULL CHECK (ST_IsValid(geom))
);

CREATE TABLE oficina (
  id                SERIAL PRIMARY KEY,
  codigo            TEXT UNIQUE NOT NULL,   -- 'VR1-001'
  nombre            TEXT NOT NULL,
  sigla             TEXT,
  tipo              TEXT NOT NULL,          -- clasificación de ambientes
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
  metodo_captura    TEXT NOT NULL,          -- 'OSM', 'Digitalización', 'GPS'
  fecha_captura     DATE NOT NULL DEFAULT CURRENT_DATE,
  verificado        BOOLEAN NOT NULL DEFAULT false,
  capa              TEXT NOT NULL DEFAULT 'VICERRECTORADO_1',
  geom              geometry(Point, 4326) NOT NULL
);

CREATE TABLE entrada (
  id          SERIAL PRIMARY KEY,
  nombre      TEXT,
  edificio_id INT REFERENCES edificio(id),
  geom        geometry(Point, 4326) NOT NULL
);

CREATE TABLE via_acceso (
  id         SERIAL PRIMARY KEY,
  nombre     TEXT,
  tipo       TEXT,                          -- sendero / vía interna
  longitud_m NUMERIC(10,2),
  geom       geometry(LineString, 4326) NOT NULL
);

CREATE INDEX ON edificio   USING GIST (geom);
CREATE INDEX ON oficina    USING GIST (geom);
CREATE INDEX ON entrada    USING GIST (geom);
CREATE INDEX ON via_acceso USING GIST (geom);

-- Cálculo de superficies y longitudes (en metros, usando geography)
CREATE FUNCTION calc_area() RETURNS trigger AS $$
BEGIN NEW.area_m2 := ST_Area(NEW.geom::geography); RETURN NEW; END $$ LANGUAGE plpgsql;
CREATE TRIGGER t_area BEFORE INSERT OR UPDATE OF geom ON edificio FOR EACH ROW EXECUTE FUNCTION calc_area();

CREATE FUNCTION calc_long() RETURNS trigger AS $$
BEGIN NEW.longitud_m := ST_Length(NEW.geom::geography); RETURN NEW; END $$ LANGUAGE plpgsql;
CREATE TRIGGER t_long BEFORE INSERT OR UPDATE OF geom ON via_acceso FOR EACH ROW EXECUTE FUNCTION calc_long();

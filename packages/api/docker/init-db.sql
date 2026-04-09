-- Creates both databases on first Postgres boot.
-- Mounted at /docker-entrypoint-initdb.d/init-db.sql

-- Lex product database (created by default via POSTGRES_DB, but explicit for clarity)
SELECT 'CREATE DATABASE lex' WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'lex')\gexec

-- Honcho memory database
SELECT 'CREATE DATABASE honcho' WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'honcho')\gexec

-- pgvector extension (needed by Honcho for embeddings)
\c honcho
CREATE EXTENSION IF NOT EXISTS vector;

\c lex
CREATE EXTENSION IF NOT EXISTS vector;

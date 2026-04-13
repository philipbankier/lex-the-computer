-- Initialization script for Lex PostgreSQL.
-- Runs once on first container start (mounted as /docker-entrypoint-initdb.d/).

CREATE DATABASE lex;
CREATE DATABASE honcho;

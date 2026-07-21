#!/bin/bash
# Init script for Supabase roles and schemas.
# Reads POSTGRES_PASSWORD from the environment (set by the container).
set -e

psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" <<-'EOSQL'
    -- Roles required by Supabase (GoTrue, PostgREST, Studio)
    -- Use DO blocks to avoid errors if roles already exist

    DO $$ BEGIN
      CREATE ROLE supabase_auth_admin NOINHERIT CREATEROLE LOGIN PASSWORD :'POSTGRES_PASSWORD';
    EXCEPTION WHEN duplicate_object THEN
      EXECUTE format('ALTER ROLE supabase_auth_admin PASSWORD %L', :'POSTGRES_PASSWORD');
    END $$;

    DO $$ BEGIN
      CREATE ROLE authenticator NOINHERIT LOGIN PASSWORD :'POSTGRES_PASSWORD';
    EXCEPTION WHEN duplicate_object THEN
      EXECUTE format('ALTER ROLE authenticator PASSWORD %L', :'POSTGRES_PASSWORD');
    END $$;

    DO $$ BEGIN
      CREATE ROLE anon NOINHERIT;
    EXCEPTION WHEN duplicate_object THEN NULL;
    END $$;

    DO $$ BEGIN
      CREATE ROLE authenticated NOINHERIT;
    EXCEPTION WHEN duplicate_object THEN NULL;
    END $$;

    DO $$ BEGIN
      CREATE ROLE service_role NOINHERIT CREATEROLE LOGIN;
    EXCEPTION WHEN duplicate_object THEN NULL;
    END $$;

    GRANT anon TO authenticator;
    GRANT authenticated TO authenticator;
    GRANT service_role TO authenticator;
    GRANT supabase_auth_admin TO supabase_admin;

    -- Set password for postgres role
    DO $$ BEGIN
      EXECUTE format('ALTER ROLE postgres PASSWORD %L', :'POSTGRES_PASSWORD');
    EXCEPTION WHEN undefined_object THEN
      CREATE ROLE postgres LOGIN PASSWORD :'POSTGRES_PASSWORD';
    END $$;

    -- Schemas
    CREATE SCHEMA IF NOT EXISTS auth;
    CREATE SCHEMA IF NOT EXISTS extensions;
    CREATE SCHEMA IF NOT EXISTS storage;
    CREATE SCHEMA IF NOT EXISTS graphql_public;
    CREATE SCHEMA IF NOT EXISTS realtime;

    -- Extensions
    CREATE EXTENSION IF NOT EXISTS "uuid-ossp" SCHEMA extensions;
    CREATE EXTENSION IF NOT EXISTS pgcrypto SCHEMA extensions;
    DO $$ BEGIN
      CREATE EXTENSION IF NOT EXISTS pgjwt SCHEMA extensions;
    EXCEPTION WHEN undefined_file THEN NULL;
    END $$;

    -- Grant usage on schemas
    GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;
    GRANT USAGE ON SCHEMA extensions TO anon, authenticated, service_role;
    GRANT USAGE ON SCHEMA graphql_public TO anon, authenticated, service_role;

    -- Grant CREATE on public schema for auth and rest migrations
    GRANT CREATE ON SCHEMA public TO supabase_auth_admin;
    GRANT CREATE ON SCHEMA public TO authenticator;

    -- Grant all on public tables to authenticated and service_role
    ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO authenticated, service_role;
    ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON FUNCTIONS TO authenticated, service_role;
    ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO authenticated, service_role;
EOSQL

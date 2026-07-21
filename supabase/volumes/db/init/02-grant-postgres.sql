-- Grant the postgres role (used by the FastAPI backend) full access to app tables.
-- This runs after 01-app-tables.sql so the tables exist.

GRANT ALL ON ALL TABLES IN SCHEMA public TO postgres;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO postgres;

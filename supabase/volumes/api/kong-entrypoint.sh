#!/bin/sh
# Substitute environment variables in kong.yml, then start Kong
set -e

cp /home/kong/temp.yml /usr/local/kong/kong.yml

# Use perl for safe substitution (handles special chars in JWT values)
perl -pi -e 's/\$\{SUPABASE_ANON_KEY\}/$ENV{SUPABASE_ANON_KEY}/g' /usr/local/kong/kong.yml
perl -pi -e 's/\$\{SUPABASE_SERVICE_ROLE_KEY\}/$ENV{SUPABASE_SERVICE_ROLE_KEY}/g' /usr/local/kong/kong.yml
perl -pi -e 's/\$\{DASHBOARD_USERNAME\}/$ENV{DASHBOARD_USERNAME}/g' /usr/local/kong/kong.yml
perl -pi -e 's/\$\{DASHBOARD_PASSWORD\}/$ENV{DASHBOARD_PASSWORD}/g' /usr/local/kong/kong.yml

# Start Kong (nginx runs in background) and keep container alive
kong start
exec tail -f /usr/local/kong/logs/error.log

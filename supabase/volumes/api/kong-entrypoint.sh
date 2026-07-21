#!/bin/sh
# Substitute environment variables in kong.yml, then start Kong
set -e

# Use sed to replace ${VAR} patterns (more portable than envsubst)
cp /home/kong/temp.yml /usr/local/kong/kong.yml

sed -i "s|\${SUPABASE_ANON_KEY}|${SUPABASE_ANON_KEY}|g" /usr/local/kong/kong.yml
sed -i "s|\${SUPABASE_SERVICE_ROLE_KEY}|${SUPABASE_SERVICE_ROLE_KEY}|g" /usr/local/kong/kong.yml
sed -i "s|\${DASHBOARD_USERNAME}|${DASHBOARD_USERNAME}|g" /usr/local/kong/kong.yml
sed -i "s|\${DASHBOARD_PASSWORD}|${DASHBOARD_PASSWORD}|g" /usr/local/kong/kong.yml

# Start Kong
exec kong start

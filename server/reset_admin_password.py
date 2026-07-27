"""Find the admin user and reset their password via GoTrue admin API."""

import asyncio, os, sys
from dotenv import load_dotenv
from supabase import create_async_client

load_dotenv()

GOTRUE_URL = os.getenv("SUPABASE_URL") or os.getenv("GOTRUE_URL", "").rsplit("/auth/v1", 1)[0]
SERVICE_KEY = os.getenv("SUPABASE_SERVICE_KEY") or os.getenv("GOTRUE_SERVICE_KEY", "")
DATABASE_URL = os.getenv("DATABASE_URL")

NEW_PASSWORD = "cteftu"

async def main():
    # 1. Find admin user from the database
    import asyncpg
    conn = await asyncpg.connect(DATABASE_URL)

    admin = await conn.fetchrow("""
        SELECT u.id, u.email
        FROM auth.users u
        JOIN public.user_preferences up ON up.user_id = u.id
        WHERE up.admin_role IN ('owner', 'manager', 'mod')
        LIMIT 1
    """)

    if not admin:
        print("No admin user found in user_preferences table.")
        # Fallback: find any user and list them
        users = await conn.fetch("SELECT id, email FROM auth.users LIMIT 10")
        print(f"Found {len(users)} users total:")
        for u in users:
            print(f"  {u['id']}  {u['email']}")
        await conn.close()
        return

    user_id = str(admin["id"])
    email = admin["email"]
    print(f"Found admin user: {email} ({user_id})")
    await conn.close()

    # 2. Reset password via GoTrue admin API
    sb = await create_async_client(GOTRUE_URL, SERVICE_KEY)
    await sb.auth.admin.update_user_by_id(user_id, {"password": NEW_PASSWORD})
    await sb.auth.sign_out()  # close the client session
    print(f"✅ Password reset to '{NEW_PASSWORD}' for {email}")

if __name__ == "__main__":
    asyncio.run(main())

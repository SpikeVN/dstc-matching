"""
Email service for DSTC Matching.
Sends transactional emails via the Resend REST API (https://api.resend.com).
Templates are Jinja2 HTML files in server/templates/.
"""

import asyncio
import logging
import os

import httpx
from jinja2 import Environment, FileSystemLoader

from auth.config import RESEND_API_KEY, EMAIL_FROM, SITE_URL
from database import fetch_one

logger = logging.getLogger(__name__)

# Jinja2 setup — templates live next to this file in server/templates/
_TEMPLATE_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "templates")
_jinja = Environment(loader=FileSystemLoader(_TEMPLATE_DIR), autoescape=True)

RESEND_API_URL = "https://api.resend.com/emails"


async def send_email(to: str, subject: str, html: str) -> bool:
    """Send an HTML email via the Resend REST API. Returns True on success."""
    if not RESEND_API_KEY:
        logger.warning("[EMAIL] RESEND_API_KEY not set — skipping email to %s", to)
        return False

    try:
        async with httpx.AsyncClient() as client:
            resp = await client.post(
                RESEND_API_URL,
                headers={
                    "Authorization": f"Bearer {RESEND_API_KEY}",
                    "Content-Type": "application/json",
                },
                json={
                    "from": EMAIL_FROM,
                    "to": [to],
                    "subject": subject,
                    "html": html,
                },
                timeout=10.0,
            )
            if resp.status_code == 200:
                logger.info("[EMAIL] Sent to %s — subject: %s", to, subject)
                return True
            else:
                logger.error("[EMAIL] Resend error %d: %s", resp.status_code, resp.text)
                return False
    except Exception:
        logger.exception("[EMAIL] Failed to send to %s", to)
        return False


def render_template(name: str, **context) -> str:
    """Render a Jinja2 template from server/templates/."""
    template = _jinja.get_template(name)
    return template.render(SITE_URL=SITE_URL, **context)


async def _get_user_and_profile(user_id: str) -> dict | None:
    """Look up a user and their contestant profile."""
    user = await fetch_one("SELECT * FROM public.users WHERE id = $1", user_id)
    if not user:
        return None
    profile = await fetch_one(
        "SELECT * FROM public.contestant_profiles WHERE created_by = $1", user_id
    )
    return {**user, "profile": profile or {}}


async def _send_match_notification(user1_id: str, user2_id: str, match_id: str):
    """Send match notification emails to both users."""
    try:
        u1 = await _get_user_and_profile(user1_id)
        u2 = await _get_user_and_profile(user2_id)
        if not u1 or not u2:
            return

        for recipient, other in [(u1, u2), (u2, u1)]:
            html = render_template(
                "match_notification.html",
                recipient_name=recipient.get("profile", {}).get("display_name") or recipient.get("full_name") or "bạn",
                other_name=other.get("profile", {}).get("display_name") or other.get("full_name") or "một người bạn",
                other_role=other.get("profile", {}).get("role", ""),
                other_school=other.get("profile", {}).get("school", ""),
                other_avatar=other.get("profile", {}).get("profile_image", ""),
                match_id=match_id,
            )
            await send_email(
                to=recipient["email"],
                subject="🎉 Bạn có match mới trên DSTC Matching!",
                html=html,
            )
    except Exception:
        logger.exception("[EMAIL] Failed to send match notification for match %s", match_id)


async def _send_message_notification(sender_id: str, receiver_id: str, match_id: str, content: str):
    """Send a new-message notification email to the receiver."""
    try:
        sender = await _get_user_and_profile(sender_id)
        receiver = await _get_user_and_profile(receiver_id)
        if not sender or not receiver:
            return

        sender_name = sender.get("profile", {}).get("display_name") or sender.get("full_name") or "Ai đó"
        receiver_name = receiver.get("profile", {}).get("display_name") or receiver.get("full_name") or "bạn"

        html = render_template(
            "message_notification.html",
            receiver_name=receiver_name,
            sender_name=sender_name,
            sender_role=sender.get("profile", {}).get("role", ""),
            sender_avatar=sender.get("profile", {}).get("profile_image", ""),
            message_preview=content[:150],
            match_id=match_id,
        )
        await send_email(
            to=receiver["email"],
            subject=f"💬 {sender_name} đã nhắn tin cho bạn",
            html=html,
        )
    except Exception:
        logger.exception("[EMAIL] Failed to send message notification for match %s", match_id)


def fire_match_notification(user1_id: str, user2_id: str, match_id: str):
    """Fire-and-forget match notification (non-blocking)."""
    asyncio.create_task(_send_match_notification(user1_id, user2_id, match_id))


def fire_message_notification(sender_id: str, receiver_id: str, match_id: str, content: str):
    """Fire-and-forget message notification (non-blocking)."""
    asyncio.create_task(_send_message_notification(sender_id, receiver_id, match_id, content))

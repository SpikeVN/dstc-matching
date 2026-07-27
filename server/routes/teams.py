import json
from fastapi import APIRouter, HTTPException, Request, Depends
from pydantic import BaseModel
from typing import Optional
from database import fetch, fetch_one, execute, generate_id, now
from auth.dependencies import get_current_user
from mailer import (
    fire_team_invitation,
    fire_team_acceptance,
    fire_disband_request,
    fire_disbandment,
)

# Helper to create a notification (imported inline to avoid circular deps)
async def _create_notification(user_id: str, type_: str, title: str, body: str = "", data: dict = None):
    from routes.notifications import create_notification_helper
    await create_notification_helper(user_id, type_, title, body, data or {})

router = APIRouter(prefix="/api/teams")


class TeamCreate(BaseModel):
    name: str
    leader_id: str
    member_ids: list = []
    max_members: int = 2
    status: str = "forming"


class DisbandRespondRequest(BaseModel):
    action: str  # "accept" or "reject"


class TeamUpdate(BaseModel):
    name: Optional[str] = None
    leader_id: Optional[str] = None
    member_ids: Optional[list] = None
    max_members: Optional[int] = None
    status: Optional[str] = None


class InviteByEmailRequest(BaseModel):
    team_id: str
    invitee_email: str


@router.post("/invite-by-email")
async def invite_by_email(req: InviteByEmailRequest, user: dict = Depends(get_current_user)):
    # 1. Look up the invitee by email in contestant_profiles
    invitee = await fetch_one(
        "SELECT created_by AS id FROM contestant_profiles WHERE email = $1",
        req.invitee_email,
    )
    if invitee is None:
        raise HTTPException(status_code=404, detail="User not found with that email")

    invitee_id = invitee["id"]

    # 2. Verify the team exists and caller is a member
    team = await fetch_one("SELECT * FROM teams WHERE id = $1", req.team_id)
    if team is None:
        raise HTTPException(status_code=404, detail="Team not found")
    member_ids = team.get("member_ids") or []
    if user["id"] not in member_ids and team["leader_id"] != user["id"]:
        raise HTTPException(status_code=403, detail="Only team members can send invites")

    # 3. Check the invitee isn't already in a team with >1 member
    existing = await fetch_one(
        "SELECT has_team, team_id FROM contestant_profiles WHERE created_by = $1",
        invitee_id,
    )
    if existing and existing.get("has_team"):
        # Allow if the user's team has only 1 member (themselves)
        if existing.get("team_id"):
            invitee_team = await fetch_one("SELECT member_ids FROM teams WHERE id = $1", existing["team_id"])
            invitee_member_count = len(invitee_team.get("member_ids") or []) if invitee_team else 0
            if invitee_member_count > 1:
                raise HTTPException(status_code=400, detail="User already has a team")
        else:
            raise HTTPException(status_code=400, detail="User already has a team")

    # 4. Check there isn't already a pending invite for this user+team
    dup = await fetch_one(
        "SELECT id FROM team_invites WHERE team_id = $1 AND invitee_id = $2 AND status = 'pending'",
        req.team_id,
        invitee_id,
    )
    if dup:
        raise HTTPException(status_code=409, detail="Invite already sent to this user")

    # 5. Create the invite
    iid = generate_id()
    now_ts = now()
    await execute(
        """
        INSERT INTO team_invites (id, created_date, updated_date, team_id, inviter_id, invitee_id, status)
        VALUES ($1, $2, $3, $4, $5, $6, $7)
        """,
        iid,
        now_ts,
        now_ts,
        req.team_id,
        user["id"],
        invitee_id,
        "pending",
    )

    # Notify the invitee
    await _create_notification(
        invitee_id,
        "team_invite",
        "Lời mời vào đội",
        f"{team.get('name', 'Unknown')} đã mời bạn vào đội",
        {"team_id": req.team_id, "inviter_id": user["id"], "invite_id": iid},
    )

    # Send email notification
    fire_team_invitation(invitee_id, user["id"], req.team_id, team.get("name", "Unknown"))

    return await fetch_one("SELECT * FROM team_invites WHERE id = $1", iid)


@router.get("")
async def list_teams(request: Request, user: dict = Depends(get_current_user)):
    query = "SELECT * FROM teams"
    params = []
    conditions = []
    idx = 1

    for key in request.query_params:
        if key in ("leader_id", "status", "name", "id"):
            conditions.append(f"{key} = ${idx}")
            params.append(request.query_params[key])
            idx += 1

    if conditions:
        query += " WHERE " + " AND ".join(conditions)

    query += " ORDER BY created_date DESC"
    return await fetch(query, *params)


@router.get("/matched-users")
async def get_matched_users(user: dict = Depends(get_current_user)):
    """Get all users the current user has matched with, with their profile info."""
    rows = await fetch("""
        SELECT DISTINCT
            CASE
                WHEN m.user1_id = $1 THEN m.user2_id
                ELSE m.user1_id
            END AS matched_user_id,
            cp.display_name,
            cp.username,
            cp.email,
            cp.profile_image,
            cp.role,
            cp.school,
            cp.has_team,
            cp.team_id
        FROM matches m
        JOIN contestant_profiles cp ON cp.created_by = CASE
            WHEN m.user1_id = $1 THEN m.user2_id
            ELSE m.user1_id
        END
        WHERE (m.user1_id = $1 OR m.user2_id = $1)
          AND m.status = 'matched'
        ORDER BY cp.display_name ASC
    """, user["id"])
    return rows


@router.get("/{team_id}")
async def get_team(team_id: str, user: dict = Depends(get_current_user)):
    row = await fetch_one("SELECT * FROM teams WHERE id = $1", team_id)
    if row is None:
        raise HTTPException(status_code=404, detail="Team not found")
    return row


@router.post("")
async def create_team(team: TeamCreate, user: dict = Depends(get_current_user)):
    tid = generate_id()
    now_ts = now()

    # Read max_members from system_settings, fall back to 2
    setting = await fetch_one(
        "SELECT value FROM system_settings WHERE key = 'team_max_members'"
    )
    max_members = team.max_members
    if setting and isinstance(setting["value"], (int, float)):
        max_members = int(setting["value"])

    # Always set leader to the authenticated user
    await execute(
        """
        INSERT INTO teams (id, created_date, updated_date, name, leader_id, member_ids, max_members, status)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
    """,
        tid,
        now_ts,
        now_ts,
        team.name,
        user["id"],
        json.dumps(team.member_ids),
        max_members,
        team.status,
    )
    return await fetch_one("SELECT * FROM teams WHERE id = $1", tid)


@router.patch("/{team_id}")
async def update_team(
    team_id: str, update: TeamUpdate, user: dict = Depends(get_current_user)
):
    existing = await fetch_one("SELECT * FROM teams WHERE id = $1", team_id)
    if existing is None:
        raise HTTPException(status_code=404, detail="Team not found")
    # Any member can update the team
    member_ids = existing.get("member_ids") or []
    if user["id"] not in member_ids and existing["leader_id"] != user["id"]:
        raise HTTPException(
            status_code=403, detail="Only team members can update the team"
        )

    fields = []
    vals = []
    idx = 1
    for key, value in update.model_dump(exclude_unset=True).items():
        if value is not None:
            if key == "member_ids":
                fields.append(f"{key} = ${idx}")
                vals.append(json.dumps(value))
            else:
                fields.append(f"{key} = ${idx}")
                vals.append(value)
            idx += 1

    if fields:
        fields.append(f"updated_date = ${idx}")
        vals.append(now())
        idx += 1
        vals.append(team_id)
        await execute(f"UPDATE teams SET {', '.join(fields)} WHERE id = ${idx}", *vals)

    return await fetch_one("SELECT * FROM teams WHERE id = $1", team_id)


@router.delete("/{team_id}")
async def leave_team(team_id: str, user: dict = Depends(get_current_user)):
    """Leave a team. Any member can leave. If last member, team is deleted."""
    existing = await fetch_one("SELECT * FROM teams WHERE id = $1", team_id)
    if existing is None:
        raise HTTPException(status_code=404, detail="Team not found")

    member_ids = existing.get("member_ids") or []
    if user["id"] not in member_ids and existing["leader_id"] != user["id"]:
        raise HTTPException(
            status_code=403, detail="Only team members can leave the team"
        )

    # Check if disband consent is required
    consent_setting = await fetch_one(
        "SELECT value FROM system_settings WHERE key = 'require_disband_consent'"
    )
    require_consent = consent_setting and consent_setting["value"] is True

    if len(member_ids) > 1 and require_consent:
        # Initiate disband consent flow instead of immediate leave
        now_ts = now()
        await execute(
            "UPDATE teams SET disband_initiated_by = $1, updated_date = $2 WHERE id = $3",
            user["id"],
            now_ts,
            team_id,
        )

        # Notify other members about disband request
        other_members = [m for m in member_ids if m != user["id"]]
        initiator_profile = await fetch_one(
            "SELECT display_name FROM contestant_profiles WHERE created_by = $1",
            user["id"],
        )
        initiator_name = initiator_profile["display_name"] if initiator_profile else user.get("username", "Ai đó")
        for other_id in other_members:
            await _create_notification(
                other_id,
                "disband_request",
                "Yêu cầu giải tán đội",
                f"{initiator_name} muốn giải tán đội {existing.get('name', 'Unknown')}",
                {"team_id": team_id, "initiated_by": user["id"]},
            )
            # Send email notification
            fire_disband_request(other_id, user["id"], team_id, existing.get("name", "Unknown"))

        return {"disband_pending": True, "message": "Disband request sent to team members for approval"}

    # Remove user from member_ids
    new_member_ids = [m for m in member_ids if m != user["id"]]
    new_leader_id = existing["leader_id"] if existing["leader_id"] != user["id"] else (new_member_ids[0] if new_member_ids else None)

    if not new_member_ids:
        # Last member leaving — delete the team
        await execute("DELETE FROM teams WHERE id = $1", team_id)
        return {"success": True, "message": "You have left the team"}
    else:
        now_ts = now()
        await execute(
            "UPDATE teams SET member_ids = $1, leader_id = $2, updated_date = $3 WHERE id = $4",
            json.dumps(new_member_ids),
            new_leader_id,
            now_ts,
            team_id,
        )
        return {"success": True, "message": "You have left the team"}


@router.post("/{team_id}/accept-invite")
async def accept_team_invite(team_id: str, user: dict = Depends(get_current_user)):
    """Accept a team invite and join the team. Verifies a pending invite exists."""
    # Verify the team exists
    team = await fetch_one("SELECT * FROM teams WHERE id = $1", team_id)
    if team is None:
        raise HTTPException(status_code=404, detail="Team not found")

    # Verify there's a pending invite for this user
    invite = await fetch_one(
        "SELECT id FROM team_invites WHERE team_id = $1 AND invitee_id = $2 AND status = 'pending'",
        team_id, user["id"],
    )
    if invite is None:
        raise HTTPException(status_code=400, detail="No pending invite found for this team")

    # Mark invite as accepted
    now_ts = now()
    await execute(
        "UPDATE team_invites SET status = 'accepted', updated_date = $1 WHERE id = $2",
        now_ts, invite["id"],
    )

    # If the user already has a team with only 1 member, delete it
    existing = await fetch_one(
        "SELECT team_id FROM contestant_profiles WHERE created_by = $1",
        user["id"],
    )
    if existing and existing.get("team_id"):
        old_team_id = existing["team_id"]
        old_team = await fetch_one("SELECT member_ids FROM teams WHERE id = $1", old_team_id)
        old_member_count = len(old_team.get("member_ids") or []) if old_team else 0
        if old_team and old_member_count <= 1:
            await execute("DELETE FROM teams WHERE id = $1", old_team_id)

    # Add user to team (keep the sender's team name)
    member_ids = team.get("member_ids") or []
    if user["id"] not in member_ids:
        member_ids.append(user["id"])
    new_status = "full" if len(member_ids) >= (team.get("max_members") or 2) else "forming"
    await execute(
        "UPDATE teams SET member_ids = $1, status = $2, updated_date = $3 WHERE id = $4",
        json.dumps(member_ids), new_status, now_ts, team_id,
    )

    # Update user's contestant profile
    await execute(
        "UPDATE contestant_profiles SET team_id = $1, has_team = true, updated_date = $2 WHERE created_by = $3",
        team_id, now_ts, user["id"],
    )

    # Notify the inviter that their invite was accepted
    inviter_id = team.get("leader_id")
    if inviter_id and inviter_id != user["id"]:
        # Fetch the acceptor's display name
        acceptor_profile = await fetch_one(
            "SELECT display_name FROM contestant_profiles WHERE created_by = $1",
            user["id"],
        )
        acceptor_name = acceptor_profile["display_name"] if acceptor_profile else user.get("username", "Ai đó")
        await _create_notification(
            inviter_id,
            "team_invite_accepted",
            "Đã chấp nhận lời mời",
            f"{acceptor_name} đã tham gia đội {team.get('name', 'Unknown')}",
            {"team_id": team_id, "accepted_by": user["id"]},
        )

        # Send email notification to inviter
        fire_team_acceptance(inviter_id, user["id"], team_id, team.get("name", "Unknown"))

    return await fetch_one("SELECT * FROM teams WHERE id = $1", team_id)


@router.post("/{team_id}/disband-respond")
async def disband_respond(
    team_id: str,
    req: DisbandRespondRequest,
    user: dict = Depends(get_current_user),
):
    """Respond to a disband request. Any other member can accept or reject."""
    existing = await fetch_one("SELECT * FROM teams WHERE id = $1", team_id)
    if existing is None:
        raise HTTPException(status_code=404, detail="Team not found")
    if existing["disband_initiated_by"] is None:
        raise HTTPException(status_code=400, detail="No disband request pending")

    # Verify the caller is a member but not the initiator
    member_ids = existing.get("member_ids") or []
    if user["id"] not in member_ids and existing["leader_id"] != user["id"]:
        raise HTTPException(status_code=403, detail="Only team members can respond to disband requests")
    if user["id"] == existing["disband_initiated_by"]:
        raise HTTPException(status_code=400, detail="Cannot respond to your own disband request")

    initiated_by = existing["disband_initiated_by"]
    responder_profile = await fetch_one(
        "SELECT display_name FROM contestant_profiles WHERE created_by = $1",
        user["id"],
    )
    responder_name = responder_profile["display_name"] if responder_profile else user.get("username", "Ai đó")

    if req.action == "accept":
        team_name = existing.get("name", "Unknown")
        # Collect all member IDs to notify after deletion
        all_members = set(existing.get("member_ids") or [])
        if existing["leader_id"]:
            all_members.add(existing["leader_id"])

        await execute("DELETE FROM teams WHERE id = $1", team_id)

        # Notify the initiator that disband was accepted
        await _create_notification(
            initiated_by,
            "disband_accepted",
            "Đội đã giải tán",
            f"{responder_name} đã đồng ý giải tán đội {team_name}",
            {"team_id": team_id, "accepted_by": user["id"]},
        )
        # Send disbandment emails to all former members
        for former_id in all_members:
            fire_disbandment(former_id, team_name, responder_name)

        return {"success": True, "message": "Team has been disbanded"}
    elif req.action == "reject":
        now_ts = now()
        await execute(
            "UPDATE teams SET disband_initiated_by = NULL, updated_date = $1 WHERE id = $2",
            now_ts,
            team_id,
        )
        # Notify the initiator that disband was rejected
        await _create_notification(
            initiated_by,
            "disband_rejected",
            "Từ chối giải tán đội",
            f"{responder_name} không đồng ý giải tán đội {existing.get('name', 'Unknown')}",
            {"team_id": team_id, "rejected_by": user["id"]},
        )
        return {"success": True, "message": "Disband request rejected"}
    else:
        raise HTTPException(status_code=400, detail="Action must be 'accept' or 'reject'")

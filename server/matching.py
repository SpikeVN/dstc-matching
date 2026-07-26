"""
Matching algorithm — pure function, no DB calls.

Call match_recommend() with pre-fetched data. Swap scoring logic freely.
"""

from dataclasses import dataclass, field


@dataclass
class ProfileData:
    """Minimal profile shape the matcher needs. Populate from DB rows."""

    id: str
    display_name: str = ""
    bio: str = ""
    gender: str = ""
    city: str = ""
    school: str = ""
    major: str = ""
    technical_skills: list[str] = field(default_factory=list)
    soft_skills: list[str] = field(default_factory=list)
    experience: str = ""
    goals: list[str] = field(default_factory=list)
    role: str = ""
    achievements: str = ""


# ── scoring helpers ────────────────────────────────────────────────

COMPLEMENTARY_ROLES: dict[str, list[str]] = {
    "Data Analyst": ["ML Engineer", "Backend Developer", "Quant Researcher"],
    "ML Engineer": ["Data Analyst", "Backend Developer", "Quant Developer"],
    "Backend Developer": ["Data Analyst", "ML Engineer", "Quant Developer"],
    "Quant Researcher": ["Quant Developer", "Quant Trader", "Data Analyst"],
    "Quant Developer": ["Quant Researcher", "Quant Trader", "Backend Developer"],
    "Quant Trader": ["Quant Researcher", "Quant Developer"],
    "All-rounder": [
        "Data Analyst", "ML Engineer", "Backend Developer",
        "Quant Researcher", "Quant Developer", "Quant Trader", "All-rounder",
    ],
}

EXPERIENCE_LEVELS: dict[str, int] = {
    "Chưa thi lần nào": 0,
    "Đã thi cuộc thi về Quant": 1,
    "Đã từng thi DSTC": 2,
}


def _score_skills(user: ProfileData, candidate: ProfileData) -> float:
    """Reward candidates whose skills complement (not duplicate) the user's."""
    my = set(user.technical_skills)
    their = set(candidate.technical_skills)
    new_skills = their - my
    return len(new_skills) * 3


def _score_goals(user: ProfileData, candidate: ProfileData) -> float:
    """Reward shared goals."""
    shared = set(user.goals) & set(candidate.goals)
    return len(shared) * 5


def _score_role(user: ProfileData, candidate: ProfileData) -> float:
    """Reward complementary roles."""
    if not user.role or not candidate.role:
        return 0
    comp = COMPLEMENTARY_ROLES.get(user.role, [])
    return 8 if candidate.role in comp else 0


def _score_experience(user: ProfileData, candidate: ProfileData) -> float:
    """Reward similar experience levels (within 1 step)."""
    a = EXPERIENCE_LEVELS.get(user.experience, 0)
    b = EXPERIENCE_LEVELS.get(candidate.experience, 0)
    return 2 if abs(a - b) <= 1 else 0


def _score_school(user: ProfileData, candidate: ProfileData) -> float:
    """Small bonus for same school — they might already know each other / share network."""
    if user.school and candidate.school and user.school == candidate.school:
        return 2
    return 0


# ── main entry point ──────────────────────────────────────────────


def score(user: ProfileData, candidate: ProfileData) -> float:
    """Total compatibility score between two profiles."""
    return (
        _score_skills(user, candidate)
        + _score_goals(user, candidate)
        + _score_role(user, candidate)
        + _score_experience(user, candidate)
        + _score_school(user, candidate)
    )


def match_recommend(
    user: ProfileData,
    remaining: list[ProfileData],
    matched: list[ProfileData],
    n: int = 10,
) -> list[ProfileData]:
    """Return the top-n most compatible profiles from *remaining*.

    *matched* is provided so future can use it (diversity, avoiding
    recommending clones of current teammates, etc.). The default impl
    ignores it — override freely.

    This function is pure: no DB calls, no side effects.
    """
    ranked = sorted(remaining, key=lambda c: score(user, c), reverse=True)
    return ranked[:n]

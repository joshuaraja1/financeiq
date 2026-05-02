from fastapi import APIRouter, Header, HTTPException
from pydantic import BaseModel
from core.database import get_db

router = APIRouter()


def _get_user_id(authorization: str | None) -> str:
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Missing token")
    token = authorization.split(" ", 1)[1]
    db = get_db()
    try:
        return db.auth.get_user(token).user.id
    except Exception:
        raise HTTPException(status_code=401, detail="Invalid token")


class ProfileUpdate(BaseModel):
    full_name: str | None = None
    risk_tolerance: str | None = None  # conservative | moderate | aggressive
    risk_capacity: str | None = None   # low | medium | high


@router.get("/profile")
def get_profile(authorization: str | None = Header(default=None)):
    user_id = _get_user_id(authorization)
    db = get_db()
    resp = db.table("user_profiles").select("*").eq("id", user_id).maybe_single().execute()
    return resp.data or {}


@router.put("/profile")
def update_profile(body: ProfileUpdate, authorization: str | None = Header(default=None)):
    user_id = _get_user_id(authorization)
    db = get_db()
    updates = {k: v for k, v in body.model_dump().items() if v is not None}
    if not updates:
        raise HTTPException(status_code=400, detail="Nothing to update")
    existing = db.table("user_profiles").select("id").eq("id", user_id).maybe_single().execute()
    if existing.data:
        resp = db.table("user_profiles").update(updates).eq("id", user_id).execute()
    else:
        updates["id"] = user_id
        resp = db.table("user_profiles").insert(updates).execute()
    return resp.data[0] if resp.data else {}

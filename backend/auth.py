"""
NetGuard AI - Cryptographic Authentication & Session Security Module
Handles bcrypt password hashing, JWT token lifecycle, session revocation, and security guards.
"""

import os
import re
import uuid
from datetime import datetime, timedelta, timezone
from typing import Any, Dict, Optional, Tuple

import bcrypt
import jwt
from fastapi import Cookie, Depends, Header, HTTPException, Request, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from database.connection import storage_manager

# ============================================================
# SECURITY CONFIGURATION
# ============================================================

JWT_SECRET = os.getenv(
    "JWT_SECRET",
    "netguard-ai-enterprise-cryptographic-signing-key-2026-production",
)
JWT_ALGORITHM = "HS256"
JWT_EXPIRATION_HOURS = int(os.getenv("JWT_EXPIRATION_HOURS", "24"))
JWT_REMEMBER_DAYS = int(os.getenv("JWT_REMEMBER_DAYS", "7"))

security_bearer = HTTPBearer(auto_error=False)

# Email format RFC-5322 compliant regex
EMAIL_REGEX = re.compile(
    r"^[a-zA-Z0-9_.+-]+@[a-zA-Z0-9-]+\.[a-zA-Z0-9-.]+$"
)


# ============================================================
# CRYPTOGRAPHIC PASSWORD HASHING
# ============================================================

def hash_password(password: str) -> str:
    """Hash password using bcrypt with 12 salt rounds."""
    if not password:
        raise ValueError("Password cannot be empty")
    salt = bcrypt.gensalt(rounds=12)
    return bcrypt.hashpw(password.encode("utf-8"), salt).decode("utf-8")


def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Verify password against bcrypt hash in constant-time."""
    if not plain_password or not hashed_password:
        return False
    try:
        return bcrypt.checkpw(
            plain_password.encode("utf-8"),
            hashed_password.encode("utf-8"),
        )
    except Exception:
        return False


# ============================================================
# INPUT VALIDATION
# ============================================================

def validate_email(email: str) -> bool:
    """Validate email format."""
    if not email or len(email) > 254:
        return False
    return bool(EMAIL_REGEX.match(email.strip()))


def validate_password_strength(password: str) -> Tuple[bool, str]:
    """
    Enforce enterprise password complexity requirements:
    - Minimum 8 characters
    - At least 1 letter
    - At least 1 numeric digit or symbol
    """
    if not password or len(password) < 8:
        return False, "Password must contain at least 8 characters."
    if len(password) > 128:
        return False, "Password exceeds maximum allowable length of 128 characters."
    if not re.search(r"[a-zA-Z]", password):
        return False, "Password must include at least one alphabetic character."
    if not re.search(r"[0-9!@#$%^&*(),.?\":{}|<>]", password):
        return False, "Password must include at least one number or special character."
    return True, ""


# ============================================================
# JWT TOKEN ISSUANCE & VERIFICATION
# ============================================================

def create_access_token(
    user: Dict[str, Any],
    remember_me: bool = False,
    expires_delta: Optional[timedelta] = None,
) -> str:
    """Generate signed JWT token containing user identity and unique jti."""
    now = datetime.now(timezone.utc)
    if expires_delta:
        expire = now + expires_delta
    elif remember_me:
        expire = now + timedelta(days=JWT_REMEMBER_DAYS)
    else:
        expire = now + timedelta(hours=JWT_EXPIRATION_HOURS)

    jti = uuid.uuid4().hex
    payload = {
        "sub": user["id"],
        "email": user["email"],
        "name": user.get("full_name", ""),
        "role": user.get("role", "operator"),
        "org": user.get("organization") or "",
        "jti": jti,
        "iat": now,
        "exp": expire,
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)


def decode_access_token(token: str) -> Optional[Dict[str, Any]]:
    """Decode and verify JWT signature and expiration."""
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        return payload
    except jwt.PyJWTError:
        return None


# ============================================================
# FASTAPI DEPENDENCIES & GUARDS
# ============================================================

def extract_token_from_request(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(security_bearer),
    netguard_token: Optional[str] = Cookie(None),
) -> Optional[str]:
    """Extract token from Authorization: Bearer header or netguard_token cookie."""
    if credentials and credentials.scheme.lower() == "bearer" and credentials.credentials:
        return credentials.credentials.strip()
    if netguard_token:
        return netguard_token.strip()
    return None


async def get_current_user(
    token: Optional[str] = Depends(extract_token_from_request),
) -> Dict[str, Any]:
    """
    Authenticate request via JWT token.
    Enforces expiration, signature, and token revocation check.
    Returns sanitized user profile dictionary.
    """
    if not token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication token required. Please sign in.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    payload = decode_access_token(token)
    if not payload:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired authentication session. Please log in again.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    jti = payload.get("jti")
    if jti and storage_manager.is_token_revoked(jti):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Session has been revoked. Please log in again.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    user_id = payload.get("sub")
    if not user_id:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Malformed token claims.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    user = storage_manager.get_user_by_id(user_id)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authenticated user account no longer exists.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    # Attach token JTI and expiry for logout handler
    user["_current_jti"] = jti
    user["_current_exp"] = payload.get("exp")

    return user


async def get_optional_current_user(
    token: Optional[str] = Depends(extract_token_from_request),
) -> Optional[Dict[str, Any]]:
    """Return authenticated user profile if token is present and valid; otherwise None."""
    if not token:
        return None
    try:
        return await get_current_user(token)
    except HTTPException:
        return None

"""Shared rate limiter instance for the DSTC Matching API.

Uses slowapi with an in-memory backend. For production with multiple workers,
migrate to Redis (slowapi supports it via the `storage_uri` option).
"""

from slowapi import Limiter
from slowapi.util import get_remote_address

limiter = Limiter(key_func=get_remote_address)

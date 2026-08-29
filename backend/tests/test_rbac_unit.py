import asyncio

import pytest
from fastapi import HTTPException

from app.dependencies import require_roles
from app.models.roles import ALL_ROLES


def test_every_product_role_is_supported():
    assert ALL_ROLES == {
        "athlete",
        "nutritionist",
        "psychologist",
        "moderator",
        "administrator",
    }
    for role in ALL_ROLES:
        dependency = require_roles(role)
        user = {"roles": [role]}
        assert asyncio.run(dependency(user)) is user


def test_rbac_rejects_missing_role():
    dependency = require_roles("administrator")
    with pytest.raises(HTTPException) as error:
        asyncio.run(dependency({"roles": ["athlete"]}))
    assert error.value.status_code == 403

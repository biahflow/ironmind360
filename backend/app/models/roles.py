from enum import StrEnum


class UserRole(StrEnum):
    ATHLETE = "athlete"
    NUTRITIONIST = "nutritionist"
    PSYCHOLOGIST = "psychologist"
    MODERATOR = "moderator"
    ADMINISTRATOR = "administrator"


ALL_ROLES = frozenset(role.value for role in UserRole)

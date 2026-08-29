from typing import Annotated, Literal, Optional

from pydantic import BaseModel, Field, StringConstraints

# Free-text list items are length-capped to keep documents small and avoid
# unbounded payloads. The list length itself is bounded on each field.
ShortText = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=80)]

TriDiscipline = Literal["swim", "bike", "run"]
ExperienceLevel = Literal["none", "beginner", "recreational", "competitive", "elite"]
ComplementaryLevel = Literal["beginner", "intermediate", "advanced"]
TrainingEnvironment = Literal["home", "gym", "both"]


class SelfAssessment(BaseModel):
    """Autoavaliação para o nível de preparação física complementar."""

    strength_training_months: int = Field(default=0, ge=0, le=600)
    weekly_active_days: int = Field(default=0, ge=0, le=7)
    returning_from_sedentary: bool = False
    can_squat_bodyweight: bool = False
    can_hinge_pattern: bool = False
    has_pain_or_injury: bool = False


class SportProfileIn(BaseModel):
    disciplines: list[TriDiscipline] = Field(default_factory=list)
    experience: ExperienceLevel = "beginner"
    weekly_availability_days: int = Field(default=0, ge=0, le=7)
    weekly_availability_hours: float = Field(default=0, ge=0, le=40)
    environment: TrainingEnvironment = "home"
    equipment: list[ShortText] = Field(default_factory=list, max_length=50)
    restrictions: list[ShortText] = Field(default_factory=list, max_length=50)
    self_assessment: SelfAssessment = Field(default_factory=SelfAssessment)
    # Ajuste manual informado do nível recomendado; None mantém a recomendação.
    complementary_level_override: Optional[ComplementaryLevel] = None


class NutritionProfileIn(BaseModel):
    allergies: list[ShortText] = Field(default_factory=list, max_length=50)
    intolerances: list[ShortText] = Field(default_factory=list, max_length=50)
    preferences: list[ShortText] = Field(default_factory=list, max_length=50)
    disliked_foods: list[ShortText] = Field(default_factory=list, max_length=100)

from typing import Literal, Optional

from pydantic import BaseModel, Field


MovementPattern = Literal[
    "squat", "hinge", "lunge",
    "push_horizontal", "push_vertical",
    "pull_horizontal", "pull_vertical",
    "anti_rotation", "anti_extension", "anti_lateral_flexion",
    "carry", "calf", "hip_stability",
    "mobility", "warmup",
]

Equipment = Literal[
    "bodyweight", "dumbbell", "barbell", "kettlebell",
    "band", "miniband", "bench", "pull_up_bar",
    "cable", "machine", "foam_roller", "swiss_ball",
    "trx", "box", "wall",
]

SessionPhase = Literal["warmup", "strength", "stability", "circuit", "cooldown"]

ProgramLevel = Literal["beginner", "intermediate", "advanced"]
ProgramEnvironment = Literal["home", "gym"]


MuscleGroup = Literal[
    "quadriceps", "hamstrings", "glutes", "calves",
    "chest", "upper_back", "lats", "shoulders", "deltoids",
    "biceps", "triceps", "forearms",
    "core", "obliques", "hip_flexors", "adductors", "abductors",
    "rotator_cuff", "scapular", "erectors",
]


class ExerciseDefinition(BaseModel):
    id: str
    name: str
    movement_pattern: MovementPattern
    equipment: list[Equipment]
    environment: Literal["home", "gym", "both"]
    min_level: ProgramLevel = "beginner"
    primary_muscles: list[MuscleGroup] = Field(default_factory=list)
    secondary_muscles: list[MuscleGroup] = Field(default_factory=list)
    image_url: Optional[str] = None
    video_url: Optional[str] = None
    instructions: str
    common_errors: str
    regression_id: Optional[str] = None
    progression_id: Optional[str] = None
    alternatives: list[str] = Field(default_factory=list)


class SessionExercise(BaseModel):
    exercise_id: str
    phase: SessionPhase
    sets: int = Field(ge=1, le=10)
    reps: Optional[str] = None
    duration_seconds: Optional[int] = None
    rest_seconds: int = Field(ge=0, le=300)
    rpe_target: Optional[int] = Field(default=None, ge=1, le=10)
    tempo: Optional[str] = None
    notes: Optional[str] = None


class ProgramSession(BaseModel):
    week: int = Field(ge=1, le=8)
    day: Literal["A", "B"]
    session_number: int = Field(ge=1, le=16)
    title: str
    is_deload: bool = False
    exercises: list[SessionExercise]


class ProgramDefinition(BaseModel):
    id: str
    name: str
    level: ProgramLevel
    environment: ProgramEnvironment
    weeks: int = 8
    sessions_per_week: int = 2
    description: str
    sessions: list[ProgramSession]


class CatalogVersion(BaseModel):
    version: str
    released_at: str
    changelog: str


class SetLog(BaseModel):
    set_number: int = Field(ge=1, le=20)
    reps: Optional[int] = Field(default=None, ge=0, le=200)
    weight_kg: Optional[float] = Field(default=None, ge=0, le=500)
    duration_seconds: Optional[int] = Field(default=None, ge=0, le=3600)
    rpe: Optional[int] = Field(default=None, ge=1, le=10)
    pain: Optional[int] = Field(default=None, ge=0, le=10)
    notes: Optional[str] = Field(default=None, max_length=300)
    completed: bool = True


class ExerciseLog(BaseModel):
    exercise_id: str
    sets: list[SetLog] = Field(default_factory=list, max_length=20)


TrainingSessionStatus = Literal["planned", "in_progress", "completed", "skipped"]


class StartSessionIn(BaseModel):
    program_id: str
    session_number: int = Field(ge=1, le=16)


class LogSetIn(BaseModel):
    exercise_id: str
    set_number: int = Field(ge=1, le=20)
    reps: Optional[int] = Field(default=None, ge=0, le=200)
    weight_kg: Optional[float] = Field(default=None, ge=0, le=500)
    duration_seconds: Optional[int] = Field(default=None, ge=0, le=3600)
    rpe: Optional[int] = Field(default=None, ge=1, le=10)
    pain: Optional[int] = Field(default=None, ge=0, le=10)
    notes: Optional[str] = Field(default=None, max_length=300)
    completed: bool = True

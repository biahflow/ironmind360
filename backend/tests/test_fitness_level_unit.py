from app.services.fitness_level import recommend_complementary_level


def test_returning_from_sedentary_recommends_beginner():
    result = recommend_complementary_level(
        {
            "strength_training_months": 60,
            "weekly_active_days": 6,
            "can_squat_bodyweight": True,
            "can_hinge_pattern": True,
            "returning_from_sedentary": True,
        }
    )
    assert result["level"] == "beginner"
    assert any("sedentário" in reason for reason in result["reasons"])


def test_active_pain_forces_beginner():
    result = recommend_complementary_level(
        {
            "strength_training_months": 48,
            "weekly_active_days": 5,
            "can_squat_bodyweight": True,
            "can_hinge_pattern": True,
            "has_pain_or_injury": True,
        }
    )
    assert result["level"] == "beginner"
    assert any("lesão" in reason.lower() or "dor" in reason.lower() for reason in result["reasons"])


def test_experienced_athlete_recommends_advanced():
    result = recommend_complementary_level(
        {
            "strength_training_months": 30,
            "weekly_active_days": 5,
            "can_squat_bodyweight": True,
            "can_hinge_pattern": True,
        }
    )
    assert result["level"] == "advanced"
    assert result["reasons"]


def test_moderate_experience_recommends_intermediate():
    result = recommend_complementary_level(
        {
            "strength_training_months": 8,
            "weekly_active_days": 3,
            "can_squat_bodyweight": True,
        }
    )
    assert result["level"] == "intermediate"


def test_empty_assessment_recommends_beginner():
    result = recommend_complementary_level({})
    assert result["level"] == "beginner"
    assert result["reasons"]

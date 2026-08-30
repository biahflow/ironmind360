"""Testes unitários do coach: tons, políticas de segurança, detecção de crise, extração de ações."""

from app.routes.coach import (
    CRISIS_KEYWORDS,
    CRISIS_RESPONSE,
    SAFETY_POLICY,
    TONE_PROMPTS,
    _extract_actions,
    detect_crisis,
    system_prompt,
)


class TestTones:
    def test_all_tones_exist(self):
        assert set(TONE_PROMPTS.keys()) == {"direct", "balanced", "supportive"}

    def test_system_prompt_uses_tone(self):
        for tone in ("direct", "balanced", "supportive"):
            result = system_prompt("Daniel", tone)
            assert "Daniel" in result
            assert SAFETY_POLICY in result

    def test_default_tone_is_balanced(self):
        result = system_prompt("Atleta", "invalid_tone")
        balanced = system_prompt("Atleta", "balanced")
        assert result == balanced

    def test_safety_policy_in_all_tones(self):
        for tone in TONE_PROMPTS:
            result = system_prompt("Test", tone)
            assert "Nunca diagnostique" in result
            assert "CVV" in result
            assert "188" in result


class TestCrisisDetection:
    def test_detects_suicidal_keywords(self):
        assert detect_crisis("Eu quero me matar")
        assert detect_crisis("nao aguento mais viver")
        assert detect_crisis("quero acabar com tudo")

    def test_case_insensitive(self):
        assert detect_crisis("QUERO ME MATAR")
        assert detect_crisis("Nao Aguento Mais")

    def test_no_false_positive_on_normal_text(self):
        assert not detect_crisis("Quero treinar mais forte amanha")
        assert not detect_crisis("Fiz uma corrida leve hoje")
        assert not detect_crisis("Estou cansado do trabalho")

    def test_crisis_response_has_contacts(self):
        assert "188" in CRISIS_RESPONSE
        assert "192" in CRISIS_RESPONSE
        assert "CVV" in CRISIS_RESPONSE

    def test_crisis_keywords_are_lowercase(self):
        for kw in CRISIS_KEYWORDS:
            assert kw == kw.lower()


class TestExtractActions:
    def test_extracts_numbered_actions(self):
        text = (
            "Veredito: semana boa.\n"
            "1. Dormir pelo menos 7h por noite\n"
            "2. Incluir um treino de mobilidade\n"
            "3. Manter a hidratacao acima de 2L\n"
        )
        actions = _extract_actions(text)
        assert len(actions) == 3
        assert actions[0]["text"] == "Dormir pelo menos 7h por noite"
        assert actions[0]["completed"] is False

    def test_extracts_with_parenthesis(self):
        text = "1) Fazer alongamento\n2) Dormir mais\n"
        actions = _extract_actions(text)
        assert len(actions) == 2

    def test_limits_to_5_actions(self):
        text = "\n".join(f"{i}. Acao {i}" for i in range(1, 10))
        actions = _extract_actions(text)
        assert len(actions) <= 5

    def test_empty_text(self):
        assert _extract_actions("") == []

    def test_no_numbered_items(self):
        assert _extract_actions("Texto sem acoes numeradas.") == []


class TestBreathingTechniques:
    def test_techniques_defined(self):
        from app.routes.coach import BREATHING_TECHNIQUES
        assert len(BREATHING_TECHNIQUES) >= 3
        for t in BREATHING_TECHNIQUES:
            assert "key" in t
            assert "name" in t
            assert "inhale_s" in t


class TestReflectionPrompts:
    def test_prompts_defined(self):
        from app.routes.coach import REFLECTION_PROMPTS
        assert len(REFLECTION_PROMPTS) >= 5
        keys = [p["key"] for p in REFLECTION_PROMPTS]
        assert "gratitude" in keys
        assert "energy" in keys

"""Enriquecimento OFFLINE do catálogo de exercícios com mídia do ExerciseDB.

Para cada exercício do nosso catálogo curado (pt-BR), resolve o correspondente
no ExerciseDB, baixa o GIF animado, sobe pro nosso S3/MinIO em
`catalog/exercises/<id>.gif` e coleta os músculos (target + secundários),
mapeando-os para os nossos literais de MuscleGroup.

Saídas:
  - app/data/exercise_media.json   (fundido no catálogo em runtime)
  - scripts/enrichment_report.md    (relatório para revisão dos matches)

Uso (dentro do container api, com EXERCISEDB_API_KEY no .env):
  docker compose exec api python -m scripts.enrich_exercise_media --dry-run   # só resolve e reporta
  docker compose exec api python -m scripts.enrich_exercise_media             # baixa + sobe pro S3 + escreve json
  docker compose exec api python -m scripts.enrich_exercise_media --only squat-goblet

O catálogo curado continua sendo a fonte de verdade; este script só acrescenta
`image_url` e preenche músculos quando ainda não há curadoria manual.
"""

from __future__ import annotations

import argparse
import asyncio
import json
import re
import time
from pathlib import Path
from typing import Optional

from app.adapters.exercisedb import ExerciseDBClient, ExerciseDBError
from app.adapters.storage import S3StorageProvider
from app.data.exercise_catalog import EXERCISES

DATA_DIR = Path(__file__).resolve().parent.parent / "app" / "data"
MEDIA_JSON = DATA_DIR / "exercise_media.json"
GIF_DIR = DATA_DIR / "exercise_gifs"
REPORT_MD = Path(__file__).resolve().parent / "enrichment_report.md"
GIF_RESOLUTION = 360

# ── target/secundários do ExerciseDB → nossos literais de MuscleGroup ──
MUSCLE_MAP: dict[str, Optional[str]] = {
    "abductors": "abductors", "abs": "core", "adductors": "adductors",
    "biceps": "biceps", "calves": "calves", "cardiovascular system": None,
    "delts": "deltoids", "forearms": "forearms", "glutes": "glutes",
    "hamstrings": "hamstrings", "lats": "lats", "levator scapulae": "scapular",
    "pectorals": "chest", "quads": "quadriceps", "serratus anterior": "core",
    "spine": "erectors", "traps": "upper_back", "triceps": "triceps",
    "upper back": "upper_back",
}

# ── nosso exercise_id → termo de busca no ExerciseDB (inglês) ──
# Prefixe com "id:" para forçar um exerciseId específico (ex.: "id:0024").
# Exercícios sem correspondente provável (mobilidade/alongamento) ficam com None
# e caem no ícone-placeholder do app.
# Termos = só o MOVIMENTO (sem equipamento — este é filtro). Alta precisão:
# só casa se todos os tokens do termo estiverem no nome. None = placeholder.
EXERCISEDB_MAP: dict[str, Optional[str]] = {
    # aquecimento
    "warmup-hip-circles": None,
    "warmup-world-greatest-stretch": None,
    "warmup-inchworm": "inchworm",
    "warmup-lateral-lunge": "side lunge",
    "warmup-band-pull-apart": "pull apart",
    "warmup-glute-bridge": "glute bridge",
    "warmup-cat-cow": "cat stretch",
    "warmup-miniband-lateral-walk": "lateral walk",
    # agachamento
    "squat-goblet": "goblet squat",
    "squat-bodyweight": "bodyweight squat",
    "squat-box": "box squat",
    "squat-sumo": "sumo squat",
    "squat-front-rack": "front squat",
    "squat-barbell-front": "front squat",
    # remada
    "row-dumbbell-unilateral": "id:0292",
    "row-band": "seated row",
    "row-dumbbell-bilateral": "bent over row",
    "row-barbell": "bent over row",
    "row-cable": "seated row",
    # stiff unilateral
    "hinge-single-leg-rdl-bw": "single leg deadlift",
    "hinge-single-leg-rdl-db": "single leg deadlift",
    "hinge-single-leg-rdl-kb": "single leg deadlift",
    "hinge-single-leg-rdl-heavy": "single leg deadlift",
    # empurrada horizontal
    "push-pushup": "id:0662",
    "push-incline-pushup": "id:0493",
    "push-db-bench-press": "bench press",
    "push-barbell-bench-press": "bench press",
    # panturrilha
    "calf-raise-standing": "standing calf raise",
    "calf-raise-seated-soleus": "seated calf raise",
    "calf-raise-weighted": "standing calf raise",
    "calf-raise-seated-weighted": "seated calf raise",
    # antirrotação / core
    "anti-rot-pallof-press-band": "pallof press",
    "anti-rot-pallof-press-cable": "pallof press",
    "anti-rot-dead-bug": "dead bug",
    "anti-rot-dead-bug-band": "dead bug",
    # stiff bilateral
    "hinge-rdl-db": "romanian deadlift",
    "hinge-hip-hinge-bw": None,
    "hinge-rdl-kb": "romanian deadlift",
    "hinge-rdl-barbell": "romanian deadlift",
    "hinge-deadlift-barbell": "deadlift",
    # avanço / step-up
    "lunge-reverse-bw": "reverse lunge",
    "lunge-reverse-db": "id:0381",
    "lunge-step-up": "step up",
    "lunge-step-up-db": "id:0431",
    "lunge-walking-db": "id:1460",
    # puxada vertical
    "pull-lat-pulldown-band": "pulldown",
    "pull-lat-pulldown-cable": "pulldown",
    "pull-chin-up-assisted": "assisted chin up",
    "pull-chin-up": "chin up",
    # empurrada vertical
    "push-overhead-db-half-kneeling": "kneeling overhead press",
    "push-overhead-db-standing": "standing overhead press",
    "push-landmine-press": "landmine press",
    "push-overhead-barbell": "military press",
    # posterior / escápulas
    "face-pull-band": "face pull",
    "face-pull-cable": "face pull",
    "prone-ywt": "y raise",
    "hip-extension-prone": "hip extension",
    "hip-extension-band": "hip extension",
    # carry / estabilidade lateral
    "carry-farmer-walk": "farmers walk",
    "carry-suitcase-walk": "suitcase carry",
    "carry-overhead-walk": "overhead carry",
    "anti-lat-side-plank": "side plank",
    "anti-lat-side-plank-hip-drop": "side plank",
    "anti-lat-copenhagen-plank": None,
    # mobilidade (maioria sem correspondente → placeholder)
    "mob-90-90-hip": None,
    "mob-couch-stretch": None,
    "mob-thoracic-rotation": None,
    "mob-pigeon-stretch": None,
    "mob-child-pose": None,
    "mob-foam-roll-thoracic": None,
    # potência / pliometria
    "power-squat-jump": "jump squat",
    "power-broad-jump": None,
    "power-box-jump": "box jump",
    "power-split-jump": "jumping lunge",
    "power-pogo-hops": None,
}

_WORD = re.compile(r"[a-z0-9]+")
# Nosso equipamento → equipamento do ExerciseDB (para o bônus de match).
EQUIP_MAP: dict[str, str] = {
    "bodyweight": "body weight", "dumbbell": "dumbbell", "barbell": "barbell",
    "kettlebell": "kettlebell", "band": "band", "miniband": "band",
    "cable": "cable", "machine": "leverage machine", "bench": "body weight",
    "box": "body weight", "pull_up_bar": "body weight",
}
# Ruído em nomes/termos que não ajuda a casar.
_STOP = {"the", "a", "with", "on", "of", "to", "two", "floor", "legs"}


def _tokens(text: str) -> list[str]:
    return _WORD.findall(text.lower())


def resolve(
    client: ExerciseDBClient, term: str, pref_equip: set[str], primary_equip: str = ""
) -> tuple[Optional[dict], str]:
    """Correspondência de ALTA PRECISÃO (ou id: fixo).

    Regra: aceita só candidatos cujo nome contenha TODOS os tokens do termo
    (o termo é só o movimento — sem equipamento) E cujo equipamento bata com o
    do nosso exercício. Entre os que passam, escolhe o nome mais canônico (menos
    palavras extras), desempatando por id menor. Se nada passa → placeholder,
    que é preferível a exibir o exercício errado.

    Retorna (candidato|None, motivo_da_rejeição)."""
    if term.startswith("id:"):
        try:
            return client.get_by_id(term[3:]), ""
        except ExerciseDBError:
            return None, "id inexistente"

    term_tokens = [t for t in _tokens(term) if t not in _STOP]
    term_set = set(term_tokens)
    # Busca pelo termo E por cada palavra-chave forte (une candidatos). Não paramos
    # cedo: a busca é por substring, então "push up" não acha "push-up" — só a
    # busca por "push" traz. Ampliar o pool e filtrar depois dá mais recall.
    keywords = [term] + [t for t in term_tokens if len(t) >= 4]
    seen: dict[str, dict] = {}
    for kw in keywords:
        try:
            for c in client.search_by_name(kw, limit=50):
                seen.setdefault(c["id"], c)
        except ExerciseDBError:
            continue
    if not seen:
        return None, "busca vazia"

    def passes(c: dict) -> bool:
        name = set(_tokens(c.get("name", "")))
        if not term_set <= name:
            return False
        if pref_equip and c.get("equipment", "").lower() not in pref_equip:
            return False
        return True

    survivors = [c for c in seen.values() if passes(c)]
    if not survivors:
        return None, "sem candidato exato+equipamento"

    # Ordena: equipamento primário do nosso exercício primeiro; depois nome mais
    # canônico (menos palavras extras, evita "clap push up"); depois id menor.
    def rank(c: dict) -> tuple:
        equip_match = 0 if primary_equip and c.get("equipment", "").lower() == primary_equip else 1
        return (equip_match, len(_tokens(c["name"])), c.get("id", "9999"))

    return min(survivors, key=rank), ""


def map_muscles(edb: dict) -> tuple[list[str], list[str]]:
    def conv(names: list[str]) -> list[str]:
        out: list[str] = []
        for n in names:
            mapped = MUSCLE_MAP.get(n.lower().strip())
            if mapped and mapped not in out:
                out.append(mapped)
        return out

    primary = conv([edb.get("target", "")])
    secondary = [m for m in conv(edb.get("secondaryMuscles", [])) if m not in primary]
    return primary, secondary


async def run(dry_run: bool, only: Optional[str], force: bool = False) -> None:
    client = ExerciseDBClient()
    storage = None if dry_run else S3StorageProvider()
    if not dry_run:
        GIF_DIR.mkdir(parents=True, exist_ok=True)

    existing = {}
    if MEDIA_JSON.exists():
        try:
            existing = json.loads(MEDIA_JSON.read_text(encoding="utf-8")).get("media", {})
        except ValueError:
            existing = {}

    media: dict[str, dict] = dict(existing)
    report_rows: list[str] = []
    matched = downloaded = skipped = 0

    for ex in EXERCISES:
        eid = ex["id"]
        if only and eid != only:
            continue
        term = EXERCISEDB_MAP.get(eid)
        if not term:
            report_rows.append(f"| {eid} | {ex['name']} | — | _sem mapeamento (placeholder)_ |")
            skipped += 1
            continue

        # Resumível: se já baixamos o GIF numa execução anterior, não refaz —
        # essencial no plano gratuito com rate limit (rode o script algumas vezes).
        # Exceção: override `id:` cujo id difere do já baixado → re-baixa (aplica a
        # correção). Passe --force para re-baixar tudo.
        prev = existing.get(eid, {})
        forced_id = term[3:] if term.startswith("id:") else None
        override_changed = bool(forced_id) and prev.get("edb_id") != forced_id
        if not dry_run and not force and prev.get("image_url") and not override_changed:
            matched += 1
            report_rows.append(
                f"| {eid} | {ex['name']} | `{term}` | {prev.get('edb_name')} "
                f"(#{prev.get('edb_id')}) — ✅ já baixado |"
            )
            continue

        equip_list = ex.get("equipment", [])
        pref_equip = {EQUIP_MAP.get(e, "") for e in equip_list}
        primary_equip = EQUIP_MAP.get(equip_list[0], "") if equip_list else ""
        edb, reason = resolve(client, term, pref_equip, primary_equip)
        if not edb:
            report_rows.append(f"| {eid} | {ex['name']} | `{term}` | ⚠️ **sem match** ({reason}) |")
            skipped += 1
            continue

        matched += 1
        primary, secondary = map_muscles(edb)
        entry = {
            "edb_id": edb.get("id"),
            "edb_name": edb.get("name"),
            "primary_muscles": primary,
            "secondary_muscles": secondary,
        }

        status = "resolvido (dry-run)"
        if not dry_run:
            try:
                gif = client.get_gif(edb["id"], GIF_RESOLUTION)
                # Empacota no repo (fonte reproduzível servida pela rota /media)…
                (GIF_DIR / f"{eid}.gif").write_bytes(gif)
                # …e melhor-esforço no S3/MinIO (enriquecimentos a quente).
                if storage is not None:
                    try:
                        await storage.put(f"catalog/exercises/{eid}.gif", gif, "image/gif")
                    except Exception:  # noqa: BLE001
                        pass
                entry["image_url"] = f"/api/v1/exercises/{eid}/media"
                downloaded += 1
                status = f"✅ GIF {len(gif) // 1024} KB"
            except (ExerciseDBError, Exception) as exc:  # noqa: BLE001
                status = f"⚠️ falha no GIF: {exc}"
        elif existing.get(eid, {}).get("image_url"):
            # Preserva image_url de uma execução anterior em dry-run.
            entry["image_url"] = existing[eid]["image_url"]

        media[eid] = entry
        report_rows.append(
            f"| {eid} | {ex['name']} | `{term}` | {edb.get('name')} "
            f"(#{edb.get('id')}, {'/'.join(primary) or '—'}) — {status} |"
        )
        # Pausa gentil para não estourar o rate limit do plano gratuito.
        time.sleep(0.4)

    if not dry_run:
        MEDIA_JSON.write_text(
            json.dumps(
                {
                    "_note": "Gerado por scripts/enrich_exercise_media.py. Nao editar a mao.",
                    "media": media,
                },
                ensure_ascii=False,
                indent=2,
            )
            + "\n",
            encoding="utf-8",
        )

    header = (
        "# Relatório de enriquecimento ExerciseDB\n\n"
        f"Modo: {'dry-run (sem S3/JSON)' if dry_run else 'completo'}  ·  "
        f"matches: {matched}  ·  GIFs baixados: {downloaded}  ·  sem mídia: {skipped}\n\n"
        "Revise os matches abaixo; ajuste `EXERCISEDB_MAP` (use `id:XXXX` para fixar) e rode de novo.\n\n"
        "| nosso id | nosso nome | termo | match ExerciseDB / status |\n"
        "|---|---|---|---|\n"
    )
    REPORT_MD.write_text(header + "\n".join(report_rows) + "\n", encoding="utf-8")

    print(f"matches={matched} gifs={downloaded} sem_midia={skipped}")
    print(f"relatório: {REPORT_MD}")
    if not dry_run:
        print(f"json: {MEDIA_JSON}")


def main() -> None:
    parser = argparse.ArgumentParser(description="Enriquece o catálogo com mídia do ExerciseDB.")
    parser.add_argument("--dry-run", action="store_true", help="Resolve e reporta sem baixar/subir nada.")
    parser.add_argument("--only", type=str, default=None, help="Processa só um exercise_id.")
    parser.add_argument("--force", action="store_true", help="Re-baixa mesmo os já baixados.")
    args = parser.parse_args()
    asyncio.run(run(args.dry_run, args.only, args.force))


if __name__ == "__main__":
    main()

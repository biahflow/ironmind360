"""Geração de relatório PDF para compartilhar com profissionais de saúde."""

from io import BytesIO

from reportlab.lib import colors as rl_colors
from reportlab.lib.enums import TA_CENTER, TA_LEFT
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import cm
from reportlab.platypus import (
    Paragraph,
    SimpleDocTemplate,
    Spacer,
    Table,
    TableStyle,
)

ACCENT = rl_colors.HexColor("#A8E51C")
DARK = rl_colors.HexColor("#151515")
SURFACE = rl_colors.HexColor("#18181A")
ALT_ROW = rl_colors.HexColor("#F7F7F4")

_WELLNESS_LABELS = {
    "sleep_hours": "Sono (h)",
    "sleep_quality": "Qualidade do Sono",
    "fatigue": "Fadiga",
    "stress": "Estresse",
    "energy": "Energia",
    "mood": "Humor",
    "motivation": "Motivação",
    "anxiety": "Ansiedade",
    "pain": "Dor",
}

_RACE_TYPE_LABELS = {
    "sprint": "Sprint",
    "olympic": "Olímpico",
    "half_ironman": "70.3",
    "ironman": "Ironman",
    "custom": "Personalizado",
}

_DISCIPLINE_LABELS = {
    "running": "Corrida",
    "cycling": "Ciclismo",
    "swimming": "Natação",
    "strength": "Força",
}


def _styles():
    base = getSampleStyleSheet()
    return {
        "title": ParagraphStyle(
            "ReportTitle",
            parent=base["Title"],
            fontSize=20,
            leading=24,
            textColor=DARK,
            alignment=TA_CENTER,
        ),
        "subtitle": ParagraphStyle(
            "ReportSubtitle",
            parent=base["Normal"],
            fontSize=11,
            leading=14,
            textColor=DARK,
            alignment=TA_CENTER,
        ),
        "section": ParagraphStyle(
            "SectionTitle",
            parent=base["Heading2"],
            fontSize=14,
            leading=18,
            textColor=DARK,
            spaceBefore=16,
            spaceAfter=8,
        ),
        "body": ParagraphStyle(
            "Body",
            parent=base["Normal"],
            fontSize=10,
            leading=13,
            textColor=DARK,
        ),
    }


def _header_table_style(cols: int):
    return TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), SURFACE),
        ("TEXTCOLOR", (0, 0), (-1, 0), rl_colors.white),
        ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
        ("FONTSIZE", (0, 0), (-1, 0), 9),
        ("FONTSIZE", (0, 1), (-1, -1), 9),
        ("FONTNAME", (0, 1), (-1, -1), "Helvetica"),
        ("ALIGN", (0, 0), (-1, -1), "CENTER"),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("ROWBACKGROUNDS", (0, 1), (-1, -1), [rl_colors.white, ALT_ROW]),
        ("GRID", (0, 0), (-1, -1), 0.5, rl_colors.HexColor("#DDDDDD")),
        ("TOPPADDING", (0, 0), (-1, -1), 4),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
    ])


def _build_load_section(data: list, styles: dict, elements: list):
    elements.append(Paragraph("Resumo de Carga", styles["section"]))
    if not data:
        elements.append(Paragraph("Sem dados de carga no período.", styles["body"]))
        return
    rows = [["Data", "TSS", "Distância (km)", "Duração (min)", "Atividades"]]
    for d in data[-30:]:
        rows.append([
            d.get("_id", ""),
            str(round(d.get("total_tss", 0), 1)),
            str(round(d.get("total_distance_km", 0), 1)),
            str(round(d.get("total_duration_min", 0), 0)),
            str(d.get("count", 0)),
        ])
    col_w = [3.2 * cm, 2.5 * cm, 3.5 * cm, 3.5 * cm, 3 * cm]
    t = Table(rows, colWidths=col_w)
    t.setStyle(_header_table_style(5))
    elements.append(t)
    if len(data) > 30:
        elements.append(Paragraph(
            f"Exibindo últimos 30 de {len(data)} dias com atividade.",
            styles["body"],
        ))


def _build_consistency_section(data: dict, styles: dict, elements: list):
    elements.append(Paragraph("Consistência", styles["section"]))
    rows = [
        ["Métrica", "Dias", "Taxa"],
        ["Atividades", str(data.get("activity_days", 0)), f"{data.get('activity_rate', 0)}%"],
        ["Check-ins", str(data.get("checkin_days", 0)), f"{data.get('checkin_rate', 0)}%"],
        ["Refeições", str(data.get("meal_days", 0)), f"{data.get('meal_rate', 0)}%"],
    ]
    t = Table(rows, colWidths=[5 * cm, 4 * cm, 4 * cm])
    t.setStyle(_header_table_style(3))
    elements.append(t)
    elements.append(Paragraph(
        f"Período: {data.get('total_days', 0)} dias.",
        styles["body"],
    ))


def _build_wellness_section(data: dict, styles: dict, elements: list):
    elements.append(Paragraph("Bem-estar", styles["section"]))
    rows = [["Métrica", "Média", "Mín", "Máx", "Registros"]]
    has_data = False
    for key, label in _WELLNESS_LABELS.items():
        series = data.get(key, [])
        if not series:
            continue
        has_data = True
        values = [p["value"] for p in series if p.get("value") is not None]
        if not values:
            continue
        avg = sum(values) / len(values)
        rows.append([
            label,
            f"{avg:.1f}",
            f"{min(values):.1f}",
            f"{max(values):.1f}",
            str(len(values)),
        ])
    if not has_data:
        elements.append(Paragraph("Sem dados de bem-estar no período.", styles["body"]))
        return
    t = Table(rows, colWidths=[4 * cm, 2.5 * cm, 2.5 * cm, 2.5 * cm, 3 * cm])
    t.setStyle(_header_table_style(5))
    elements.append(t)


def _build_nutrition_section(data: list, styles: dict, elements: list):
    elements.append(Paragraph("Nutrição", styles["section"]))
    if not data:
        elements.append(Paragraph("Sem dados de nutrição no período.", styles["body"]))
        return
    total_cal = sum(d.get("calories", 0) for d in data)
    total_prot = sum(d.get("protein_g", 0) for d in data)
    total_carb = sum(d.get("carbs_g", 0) for d in data)
    total_fat = sum(d.get("fat_g", 0) for d in data)
    n = len(data)
    rows = [
        ["Métrica", "Média Diária"],
        ["Calorias", f"{total_cal / n:.0f} kcal"],
        ["Proteína", f"{total_prot / n:.1f} g"],
        ["Carboidratos", f"{total_carb / n:.1f} g"],
        ["Gordura", f"{total_fat / n:.1f} g"],
    ]
    t = Table(rows, colWidths=[6 * cm, 6 * cm])
    t.setStyle(_header_table_style(2))
    elements.append(t)
    elements.append(Paragraph(f"Baseado em {n} dias com refeições registradas.", styles["body"]))


def _build_records_section(data: dict, styles: dict, elements: list):
    elements.append(Paragraph("Recordes Pessoais", styles["section"]))
    has_any = False
    for disc_key, disc_label in _DISCIPLINE_LABELS.items():
        disc_data = data.get(disc_key, {})
        if not disc_data:
            continue
        has_any = True
        elements.append(Paragraph(disc_label, ParagraphStyle(
            f"Sub_{disc_key}", fontSize=11, leading=14,
            textColor=DARK, fontName="Helvetica-Bold",
            spaceBefore=6, spaceAfter=4,
        )))
        rows = [["Recorde", "Valor", "Data"]]
        for key, rec in disc_data.items():
            label = key.replace("best_pace_", "Pace ").replace("best_speed", "Vel. Máx").replace(
                "longest_ride_km", "Maior Pedal"
            ).replace("pr_", "PR ")
            val = rec.get("value", "")
            unit = rec.get("unit", "")
            reps = rec.get("reps")
            val_str = f"{val} {unit}"
            if reps:
                val_str += f" × {reps} reps"
            rows.append([label, val_str, rec.get("date", "")])
        t = Table(rows, colWidths=[5 * cm, 5 * cm, 4 * cm])
        t.setStyle(_header_table_style(3))
        elements.append(t)
    if not has_any:
        elements.append(Paragraph("Nenhum recorde registrado.", styles["body"]))


def _build_races_section(data: list, styles: dict, elements: list):
    elements.append(Paragraph("Histórico de Provas", styles["section"]))
    if not data:
        elements.append(Paragraph("Nenhuma prova registrada.", styles["body"]))
        return
    rows = [["Nome", "Tipo", "Data", "Prioridade", "Resultado"]]
    for r in data:
        race_type = _RACE_TYPE_LABELS.get(r.get("race_type", ""), r.get("race_type", ""))
        rows.append([
            r.get("name", ""),
            race_type,
            r.get("date", ""),
            r.get("priority", ""),
            r.get("result", "") or "—",
        ])
    t = Table(rows, colWidths=[4 * cm, 2.5 * cm, 3 * cm, 2.5 * cm, 4 * cm])
    t.setStyle(_header_table_style(5))
    elements.append(t)


def _build_strength_section(data: dict, styles: dict, elements: list):
    elements.append(Paragraph("Progresso de Força", styles["section"]))
    if not data:
        elements.append(Paragraph("Sem dados de treino de força.", styles["body"]))
        return
    rows = [["Exercício", "Último Peso (kg)", "Reps", "Volume", "Data"]]
    for ex_id, entries in data.items():
        if not entries:
            continue
        latest = entries[-1]
        label = ex_id.replace("-", " ").replace("_", " ").title()
        rows.append([
            label,
            str(latest.get("weight_kg", "—")),
            str(latest.get("reps", "—")),
            str(round(latest.get("volume", 0), 1)),
            latest.get("date", ""),
        ])
    if len(rows) == 1:
        elements.append(Paragraph("Sem dados de treino de força.", styles["body"]))
        return
    t = Table(rows, colWidths=[4.5 * cm, 3 * cm, 2 * cm, 3 * cm, 3 * cm])
    t.setStyle(_header_table_style(5))
    elements.append(t)


def generate_report_pdf(data: dict, user_name: str, days: int = 28) -> bytes:
    buf = BytesIO()
    doc = SimpleDocTemplate(
        buf,
        pagesize=A4,
        leftMargin=1.5 * cm,
        rightMargin=1.5 * cm,
        topMargin=1.5 * cm,
        bottomMargin=1.5 * cm,
    )
    styles = _styles()
    elements: list = []

    # Header band
    header_data = [[
        Paragraph("IronMind 360 — Relatório do Atleta", styles["title"]),
    ]]
    header_table = Table(header_data, colWidths=[doc.width])
    header_table.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, -1), ACCENT),
        ("TOPPADDING", (0, 0), (-1, -1), 14),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 14),
        ("ALIGN", (0, 0), (-1, -1), "CENTER"),
    ]))
    elements.append(header_table)
    elements.append(Spacer(1, 8))

    elements.append(Paragraph(
        f"Atleta: <b>{user_name}</b> &nbsp;|&nbsp; Período: {days} dias",
        styles["subtitle"],
    ))
    elements.append(Spacer(1, 16))

    if "load" in data:
        _build_load_section(data["load"], styles, elements)
        elements.append(Spacer(1, 10))
    if "consistency" in data:
        _build_consistency_section(data["consistency"], styles, elements)
        elements.append(Spacer(1, 10))
    if "wellness" in data:
        _build_wellness_section(data["wellness"], styles, elements)
        elements.append(Spacer(1, 10))
    if "nutrition" in data:
        _build_nutrition_section(data["nutrition"], styles, elements)
        elements.append(Spacer(1, 10))
    if "records" in data:
        _build_records_section(data["records"], styles, elements)
        elements.append(Spacer(1, 10))
    if "races" in data:
        _build_races_section(data["races"], styles, elements)
        elements.append(Spacer(1, 10))
    if "strength" in data:
        _build_strength_section(data["strength"], styles, elements)

    elements.append(Spacer(1, 20))
    elements.append(Paragraph(
        "Relatório gerado automaticamente pelo IronMind 360. "
        "Dados observacionais — consulte um profissional para interpretação.",
        ParagraphStyle(
            "Footer", fontSize=8, leading=10,
            textColor=rl_colors.HexColor("#888888"),
            alignment=TA_CENTER,
        ),
    ))

    doc.build(elements)
    return buf.getvalue()

"""
PDF Export module using ReportLab.
Generates a printable partogram report for a patient.
"""
import io
from datetime import datetime
from reportlab.lib.pagesizes import A4
from reportlab.lib import colors
from reportlab.lib.units import mm
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.platypus import (
    SimpleDocTemplate, Table, TableStyle, Paragraph, Spacer, HRFlowable
)
from reportlab.graphics.shapes import Drawing, Line, String, Rect, PolyLine
from reportlab.graphics import renderPDF
from reportlab.lib.enums import TA_CENTER, TA_LEFT


TEAL = colors.HexColor("#00C9A7")
NAVY = colors.HexColor("#0A0F1E")
LIGHT_NAVY = colors.HexColor("#1A2744")
RED = colors.HexColor("#FF4D6D")
YELLOW = colors.HexColor("#FFD166")
WHITE = colors.white
GREY = colors.HexColor("#8892A4")


def _header_section(patient):
    styles = getSampleStyleSheet()
    title_style = ParagraphStyle(
        "title",
        parent=styles["Heading1"],
        fontSize=18,
        textColor=TEAL,
        spaceAfter=4,
        alignment=TA_CENTER,
    )
    sub_style = ParagraphStyle(
        "sub",
        parent=styles["Normal"],
        fontSize=10,
        textColor=GREY,
        alignment=TA_CENTER,
        spaceAfter=10,
    )
    flowables = [
        Paragraph("e-Partogram Report", title_style),
        Paragraph("Electronic Labor Monitoring System — TanPrish Dynamics", sub_style),
        HRFlowable(width="100%", thickness=1, color=TEAL, spaceAfter=8),
    ]

    admission = patient.admission_time
    if isinstance(admission, str):
        try:
            admission = datetime.fromisoformat(admission)
        except Exception:
            pass

    data = [
        ["Patient ID", patient.patient_id, "Name", patient.name],
        ["Age", f"{patient.age} years", "Gestational Age", f"{patient.gestational_age} weeks"],
        ["Gravida", str(patient.gravida), "Parity", str(patient.parity)],
        ["Admission", admission.strftime("%d %b %Y  %H:%M") if hasattr(admission, "strftime") else str(admission), "Report Generated", datetime.now().strftime("%d %b %Y  %H:%M")],
    ]
    table = Table(data, colWidths=[35 * mm, 55 * mm, 35 * mm, 55 * mm])
    table.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, -1), LIGHT_NAVY),
        ("TEXTCOLOR", (0, 0), (-1, -1), WHITE),
        ("FONTNAME", (0, 0), (-1, -1), "Helvetica"),
        ("FONTSIZE", (0, 0), (-1, -1), 9),
        ("FONTNAME", (0, 0), (0, -1), "Helvetica-Bold"),
        ("FONTNAME", (2, 0), (2, -1), "Helvetica-Bold"),
        ("TEXTCOLOR", (0, 0), (0, -1), TEAL),
        ("TEXTCOLOR", (2, 0), (2, -1), TEAL),
        ("ROWBACKGROUNDS", (0, 0), (-1, -1), [LIGHT_NAVY, colors.HexColor("#111D35")]),
        ("GRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#2A3A5C")),
        ("PADDING", (0, 0), (-1, -1), 6),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
    ]))
    flowables.append(table)
    flowables.append(Spacer(1, 10))
    return flowables


def _partograph_drawing(observations, width=180 * mm, height=80 * mm):
    """Draw the partograph cervical dilation chart inline."""
    d = Drawing(width, height)
    pad_left = 30
    pad_right = 10
    pad_top = 10
    pad_bottom = 25

    chart_w = width - pad_left - pad_right
    chart_h = height - pad_top - pad_bottom

    # Background
    d.add(Rect(pad_left, pad_bottom, chart_w, chart_h, fillColor=colors.HexColor("#0D1B2A"), strokeColor=TEAL, strokeWidth=0.5))

    # Y-axis grid lines (0–10 cm)
    for cm in range(0, 11):
        y = pad_bottom + (cm / 10) * chart_h
        d.add(Line(pad_left, y, pad_left + chart_w, y, strokeColor=colors.HexColor("#1A2744"), strokeWidth=0.3))
        d.add(String(pad_left - 4, y - 3, str(cm), fontSize=6, fillColor=GREY, textAnchor="end"))

    # X-axis labels and grid (hours 0–12)
    obs_sorted = sorted(observations, key=lambda o: o.timestamp) if observations else []
    if not obs_sorted:
        d.add(String(width / 2, height / 2, "No observations recorded", fontSize=10, fillColor=GREY, textAnchor="middle"))
        return d

    t0 = obs_sorted[0].timestamp
    max_hours = max((o.timestamp - t0).total_seconds() / 3600 for o in obs_sorted) or 1
    max_hours = max(max_hours, 12)

    for hr in range(0, int(max_hours) + 2, 2):
        x = pad_left + (hr / max_hours) * chart_w
        d.add(Line(x, pad_bottom, x, pad_bottom + chart_h, strokeColor=colors.HexColor("#1A2744"), strokeWidth=0.3))
        d.add(String(x, pad_bottom - 10, f"{hr}h", fontSize=6, fillColor=GREY, textAnchor="middle"))

    # Alert line (1 cm/hr from 4 cm at hour 0 of active phase)
    # Find active phase start (first observation >= 4 cm)
    active_start = next((o for o in obs_sorted if o.cervical_dilation and o.cervical_dilation >= 4.0), None)
    if active_start:
        t_active = (active_start.timestamp - t0).total_seconds() / 3600
        alert_pts = []
        action_pts = []
        for h in range(0, int(max_hours) + 2):
            hours_from_active = h - t_active
            if hours_from_active < 0:
                hours_from_active = 0
            alert_dil = min(4.0 + hours_from_active, 10.0)
            action_dil = min(4.0 + max(0, hours_from_active - 4), 10.0)
            x = pad_left + (h / max_hours) * chart_w
            ay = pad_bottom + (alert_dil / 10) * chart_h
            cy = pad_bottom + (action_dil / 10) * chart_h
            alert_pts.extend([x, ay])
            action_pts.extend([x, cy])

        if len(alert_pts) >= 4:
            d.add(PolyLine(alert_pts, strokeColor=YELLOW, strokeWidth=1.2, strokeDashArray=[4, 2]))
        if len(action_pts) >= 4:
            d.add(PolyLine(action_pts, strokeColor=RED, strokeWidth=1.2, strokeDashArray=[2, 2]))

    # Actual dilation curve
    dil_pts = []
    for o in obs_sorted:
        if o.cervical_dilation is not None:
            hours = (o.timestamp - t0).total_seconds() / 3600
            x = pad_left + (hours / max_hours) * chart_w
            y = pad_bottom + (o.cervical_dilation / 10) * chart_h
            dil_pts.extend([x, y])

    if len(dil_pts) >= 4:
        d.add(PolyLine(dil_pts, strokeColor=TEAL, strokeWidth=2))

    # Axis labels
    d.add(String(pad_left - 22, pad_bottom + chart_h / 2, "Cervical Dilation (cm)", fontSize=7, fillColor=TEAL, textAnchor="middle"))
    d.add(String(pad_left + chart_w / 2, 4, "Time from Admission (hours)", fontSize=7, fillColor=TEAL, textAnchor="middle"))

    return d


def _observations_table(observations):
    styles = getSampleStyleSheet()
    header_style = ParagraphStyle("th", parent=styles["Normal"], fontSize=7, textColor=TEAL, fontName="Helvetica-Bold")
    cell_style = ParagraphStyle("td", parent=styles["Normal"], fontSize=7, textColor=WHITE)

    headers = ["Time", "Dil (cm)", "FHR", "Contractions", "Station", "BP", "Pulse", "Temp", "Fluid"]
    data = [[Paragraph(h, header_style) for h in headers]]

    for o in sorted(observations, key=lambda ob: ob.timestamp):
        ts = o.timestamp.strftime("%H:%M") if hasattr(o.timestamp, "strftime") else str(o.timestamp)[:16]
        dil = f"{o.cervical_dilation}" if o.cervical_dilation is not None else "—"
        fhr = f"{o.fetal_heart_rate}" if o.fetal_heart_rate else "—"
        contrax = f"{o.contraction_freq}/10m" if o.contraction_freq else "—"
        station = f"{o.head_station:+g}" if o.head_station is not None else "—"
        bp = f"{o.bp_systolic}/{o.bp_diastolic}" if o.bp_systolic else "—"
        pulse = f"{o.maternal_pulse}" if o.maternal_pulse else "—"
        temp = f"{o.temperature}°C" if o.temperature else "—"
        fluid = str(o.amniotic_fluid or "—")
        row = [Paragraph(v, cell_style) for v in [ts, dil, fhr, contrax, station, bp, pulse, temp, fluid]]
        data.append(row)

    col_widths = [20 * mm, 18 * mm, 15 * mm, 25 * mm, 18 * mm, 22 * mm, 16 * mm, 18 * mm, 20 * mm]
    table = Table(data, colWidths=col_widths, repeatRows=1)
    table.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), LIGHT_NAVY),
        ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.HexColor("#0D1B2A"), colors.HexColor("#111D35")]),
        ("GRID", (0, 0), (-1, -1), 0.4, colors.HexColor("#2A3A5C")),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("PADDING", (0, 0), (-1, -1), 4),
    ]))
    return table


def _alerts_table(alerts):
    styles = getSampleStyleSheet()
    th_style = ParagraphStyle("th", parent=styles["Normal"], fontSize=7, textColor=TEAL, fontName="Helvetica-Bold")
    data = [[Paragraph(h, th_style) for h in ["Time", "Severity", "Type", "Message"]]]
    sev_colors = {"red": RED, "yellow": YELLOW, "green": colors.HexColor("#06D6A0")}

    for a in sorted(alerts, key=lambda x: x.timestamp):
        ts = a.timestamp.strftime("%H:%M %d/%m") if hasattr(a.timestamp, "strftime") else str(a.timestamp)[:16]
        sev_color = sev_colors.get(a.severity, WHITE)
        sev_style = ParagraphStyle("sev", parent=styles["Normal"], fontSize=7, textColor=sev_color, fontName="Helvetica-Bold")
        cell_style = ParagraphStyle("td", parent=styles["Normal"], fontSize=7, textColor=WHITE)
        data.append([
            Paragraph(ts, cell_style),
            Paragraph(a.severity.upper(), sev_style),
            Paragraph(a.alert_type.replace("_", " "), cell_style),
            Paragraph(a.message[:100] + ("..." if len(a.message) > 100 else ""), cell_style),
        ])

    col_widths = [22 * mm, 20 * mm, 38 * mm, 100 * mm]
    table = Table(data, colWidths=col_widths, repeatRows=1)
    table.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), LIGHT_NAVY),
        ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.HexColor("#0D1B2A"), colors.HexColor("#111D35")]),
        ("GRID", (0, 0), (-1, -1), 0.4, colors.HexColor("#2A3A5C")),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("PADDING", (0, 0), (-1, -1), 4),
    ]))
    return table


def generate_pdf(patient, observations, alerts):
    """
    Generate a PDF report for a patient and return as bytes.
    """
    buffer = io.BytesIO()
    doc = SimpleDocTemplate(
        buffer,
        pagesize=A4,
        rightMargin=15 * mm,
        leftMargin=15 * mm,
        topMargin=15 * mm,
        bottomMargin=15 * mm,
        title=f"Partogram - {patient.patient_id}",
    )

    styles = getSampleStyleSheet()
    section_style = ParagraphStyle(
        "section",
        parent=styles["Heading2"],
        fontSize=11,
        textColor=TEAL,
        spaceBefore=12,
        spaceAfter=6,
    )

    story = []
    story.extend(_header_section(patient))
    story.append(Spacer(1, 6))

    # Partograph chart
    story.append(Paragraph("Partograph — Cervical Dilation Curve", section_style))
    if observations:
        drawing = _partograph_drawing(observations)
        story.append(drawing)
    else:
        story.append(Paragraph("No observations recorded.", styles["Normal"]))

    # Legend
    legend_data = [["🔵 Actual Dilation", "🟡 Alert Line (1 cm/hr)", "🔴 Action Line (+4 hrs)"]]
    legend = Table(legend_data, colWidths=[60 * mm, 60 * mm, 60 * mm])
    legend.setStyle(TableStyle([
        ("TEXTCOLOR", (0, 0), (-1, -1), GREY),
        ("FONTSIZE", (0, 0), (-1, -1), 8),
        ("ALIGN", (0, 0), (-1, -1), "CENTER"),
    ]))
    story.append(legend)
    story.append(Spacer(1, 8))

    # Observations table
    story.append(Paragraph("Labor Observations", section_style))
    if observations:
        story.append(_observations_table(observations))
    else:
        story.append(Paragraph("No observations recorded.", styles["Normal"]))
    story.append(Spacer(1, 8))

    # Alerts table
    story.append(Paragraph("Clinical Alerts", section_style))
    if alerts:
        story.append(_alerts_table(alerts))
    else:
        story.append(Paragraph("No clinical alerts generated.", styles["Normal"]))

    # Footer
    story.append(Spacer(1, 16))
    story.append(HRFlowable(width="100%", thickness=0.5, color=GREY))
    footer_style = ParagraphStyle("footer", parent=styles["Normal"], fontSize=7, textColor=GREY, alignment=TA_CENTER)
    story.append(Paragraph(
        f"Generated by e-Partogram System · TanPrish Dynamics · {datetime.now().strftime('%d %b %Y %H:%M')} · CONFIDENTIAL MEDICAL RECORD",
        footer_style,
    ))

    doc.build(story)
    buffer.seek(0)
    return buffer.read()

import csv
import io
from reportlab.lib.pagesizes import letter
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import inch
from reportlab.lib import colors
from reportlab.platypus import SimpleDocTemplate, Table, TableStyle, Paragraph, Spacer

def generate_csv_report(results: list, summary: dict, filename: str) -> bytes:
    output = io.StringIO()
    writer = csv.writer(output)

    writer.writerow(["TAX DEDUCTION HUNTER — DEDUCTION REPORT"])
    writer.writerow(["Source file:", filename])
    writer.writerow(["Total transactions:", summary["parsed_rows"]])
    writer.writerow([])

    writer.writerow(["Date", "Description", "Amount", "Category", "Eligibility", "Deduction Bucket", "Confidence", "Reason", "Source"])

    for item in results:
        tx = item["transaction"]
        cl = item["classification"]
        writer.writerow([
            tx.get("date", ""),
            tx.get("description", ""),
            tx.get("amount", ""),
            cl.get("category", ""),
            cl.get("eligibility", ""),
            cl.get("deduction_bucket", ""),
            cl.get("confidence", ""),
            cl.get("reason", ""),
            cl.get("source", ""),
        ])

    return output.getvalue().encode("utf-8")


def generate_pdf_report(results: list, summary: dict, filename: str) -> bytes:
    output = io.BytesIO()
    doc = SimpleDocTemplate(output, pagesize=letter,
                            rightMargin=0.75*inch, leftMargin=0.75*inch,
                            topMargin=0.75*inch, bottomMargin=0.75*inch)

    styles = getSampleStyleSheet()
    elements = []

    # Title
    title_style = ParagraphStyle("title", fontSize=20, fontName="Helvetica-Bold", spaceAfter=4, textColor=colors.HexColor("#00cc66"))
    sub_style = ParagraphStyle("sub", fontSize=10, fontName="Helvetica", spaceAfter=16, textColor=colors.HexColor("#888888"))
    elements.append(Paragraph("Tax Deduction Hunter", title_style))
    elements.append(Paragraph(f"Deduction Report — {filename}", sub_style))
    elements.append(Spacer(1, 0.1*inch))

    # Summary box
    deductible_total = sum(
        abs(r["transaction"]["amount"])
        for r in results
        if r["classification"]["eligibility"] in ["deductible", "likely deductible", "partially deductible"]
        and r["transaction"]["amount"] < 0
    )

    summary_data = [
        ["Total Transactions", str(summary["parsed_rows"])],
        ["Date Range", f"{summary.get('date_range_start', 'N/A')} → {summary.get('date_range_end', 'N/A')}"],
        ["Likely Deductible Total", f"${deductible_total:,.2f}"],
        ["Needs Review", str(sum(1 for r in results if r["classification"]["eligibility"] == "review needed"))],
    ]

    summary_table = Table(summary_data, colWidths=[2.5*inch, 3*inch])
    summary_table.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (0, -1), colors.HexColor("#f0f0f0")),
        ("FONTNAME", (0, 0), (0, -1), "Helvetica-Bold"),
        ("FONTSIZE", (0, 0), (-1, -1), 10),
        ("GRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#dddddd")),
        ("ROWBACKGROUNDS", (0, 0), (-1, -1), [colors.white, colors.HexColor("#f9f9f9")]),
        ("PADDING", (0, 0), (-1, -1), 6),
    ]))
    elements.append(summary_table)
    elements.append(Spacer(1, 0.25*inch))

    # Transactions table
    elements.append(Paragraph("All Transactions", ParagraphStyle("h2", fontSize=13, fontName="Helvetica-Bold", spaceAfter=8)))

    headers = ["Date", "Description", "Amount", "Category", "Eligibility"]
    rows = [headers]

    ELIGIBILITY_COLORS = {
        "deductible": colors.HexColor("#d4f5e2"),
        "likely deductible": colors.HexColor("#e8f5ee"),
        "partially deductible": colors.HexColor("#fff8e1"),
        "review needed": colors.HexColor("#fff3cd"),
        "non-deductible": colors.HexColor("#f5f5f5"),
    }

    row_colors = [colors.HexColor("#00cc66")]  # header row color placeholder
    for item in results:
        tx = item["transaction"]
        cl = item["classification"]
        rows.append([
            tx.get("date") or "—",
            tx.get("description", "")[:45],
            f"${abs(tx.get('amount', 0)):.2f}",
            cl.get("category", "")[:25],
            cl.get("eligibility", ""),
        ])
        row_colors.append(ELIGIBILITY_COLORS.get(cl.get("eligibility", ""), colors.white))

    col_widths = [0.9*inch, 2.8*inch, 0.8*inch, 1.5*inch, 1.3*inch]
    tx_table = Table(rows, colWidths=col_widths, repeatRows=1)

    table_style = [
        ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#111111")),
        ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
        ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
        ("FONTSIZE", (0, 0), (-1, -1), 8.5),
        ("GRID", (0, 0), (-1, -1), 0.4, colors.HexColor("#dddddd")),
        ("PADDING", (0, 0), (-1, -1), 5),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
    ]

    for i, color in enumerate(row_colors[1:], start=1):
        table_style.append(("BACKGROUND", (0, i), (-1, i), color))

    tx_table.setStyle(TableStyle(table_style))
    elements.append(tx_table)

    # Footer note
    elements.append(Spacer(1, 0.3*inch))
    note_style = ParagraphStyle("note", fontSize=8, textColor=colors.HexColor("#999999"), fontName="Helvetica-Oblique")
    elements.append(Paragraph(
        "⚠ This report is AI-generated and intended to assist with tax preparation. "
        "It does not constitute legal or tax advice. Please review all suggestions with a qualified tax professional.",
        note_style
    ))

    doc.build(elements)
    return output.getvalue()
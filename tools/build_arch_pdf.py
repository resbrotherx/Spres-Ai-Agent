#!/usr/bin/env python3
"""
Generate a multi-page PDF with an architecture diagram and descriptive pages for the Brainbox project.
Produces: Brainbox_Architecture.pdf in the repository root.
"""
from reportlab.pdfgen import canvas
from reportlab.lib.pagesizes import A4, landscape
from reportlab.lib import colors
from reportlab.lib.units import mm
from datetime import datetime
import textwrap

OUT_PDF = r"C:\Users\USER\Documents\PERSONAL\ai\Brainbox_Architecture.pdf"

PAGE_WIDTH, PAGE_HEIGHT = landscape(A4)
MARGIN = 20 * mm


def draw_cover(c):
    c.setFont("Helvetica-Bold", 28)
    c.drawCentredString(PAGE_WIDTH / 2, PAGE_HEIGHT - 60, "Brainbox — Architecture & Product Overview")

    c.setFont("Helvetica", 12)
    subtitle = "High-level flow diagram, SDKs, backend components, tools, and roadmap ideas"
    c.drawCentredString(PAGE_WIDTH / 2, PAGE_HEIGHT - 86, subtitle)

    c.setFont("Helvetica", 10)
    c.drawCentredString(PAGE_WIDTH / 2, PAGE_HEIGHT - 110, f"Generated: {datetime.utcnow().strftime('%Y-%m-%d %H:%M UTC')}")

    # Small description box
    c.setStrokeColor(colors.grey)
    c.setFillColor(colors.whitesmoke)
    box_w = PAGE_WIDTH - 2 * MARGIN
    box_h = 80 * mm
    x = MARGIN
    y = PAGE_HEIGHT - 140 - box_h
    c.rect(x, y, box_w, box_h, fill=1, stroke=0)

    c.setFillColor(colors.black)
    text = (
        "This document summarizes how the Brainbox system operates, the SDKs available for customers, "
        "the backend components (ingestion, AI agents, database, dashboard), and integration points for web, "
        "mobile, and Odoo. It is intended as a shareable business-and-technical overview for boards, teams, and developers."
    )
    draw_wrapped_text(c, text, x + 8, y + box_h - 14, box_w - 16, 11)

    c.showPage()


def draw_wrapped_text(c, text, x, y, max_width, font_size=10, leading=None):
    if leading is None:
        leading = font_size + 2
    c.setFont("Helvetica", font_size)
    wrapped = textwrap.wrap(text, width= int(max_width / (font_size * 0.55)))
    for i, line in enumerate(wrapped):
        c.drawString(x, y - i * leading, line)


def draw_box(c, x, y, w, h, title, fill_color=colors.lightblue, stroke_color=colors.darkblue, title_size=10, text_size=8):
    c.setFillColor(fill_color)
    c.setStrokeColor(stroke_color)
    c.roundRect(x, y, w, h, 6, fill=1)
    c.setFillColor(colors.black)
    c.setFont("Helvetica-Bold", title_size)
    c.drawString(x + 6, y + h - title_size - 6, title)


def draw_arrow(c, x1, y1, x2, y2, stroke=1):
    c.setStrokeColor(colors.black)
    c.setLineWidth(stroke)
    c.line(x1, y1, x2, y2)
    # draw simple arrowhead
    from math import atan2, sin, cos, pi
    angle = atan2(y2 - y1, x2 - x1)
    size = 8
    a1 = angle + pi * 3 / 4
    a2 = angle - pi * 3 / 4
    c.line(x2, y2, x2 + cos(a1) * size, y2 + sin(a1) * size)
    c.line(x2, y2, x2 + cos(a2) * size, y2 + sin(a2) * size)


def draw_diagram(c):
    # Layout: left = Customer, center = Transport, right = Brainbox Backend, bottom = SDKs & Tools
    left_x = MARGIN + 10
    center_x = PAGE_WIDTH / 2 - 60
    right_x = PAGE_WIDTH - MARGIN - 260

    # CUSTOMER INFRA
    cx = left_x
    cy = PAGE_HEIGHT - 60 - 40
    draw_box(c, cx, cy, 220, 120, "Customer Infrastructure", fill_color=colors.whitesmoke, stroke_color=colors.grey)
    inner_x = cx + 8
    inner_y = cy + 8
    c.setFont("Helvetica", 9)
    c.drawString(inner_x, inner_y + 88, "- Mobile apps (React Native)")
    c.drawString(inner_x, inner_y + 72, "- Next.js / React web apps")
    c.drawString(inner_x, inner_y + 56, "- Odoo / Plain HTML pages (sdk-web)")
    c.drawString(inner_x, inner_y + 40, "- Backend services (Python/Node)")
    c.drawString(inner_x, inner_y + 24, "- Customer DB (Postgres, MySQL, SQLite)")
    c.drawString(inner_x, inner_y + 8, "- CLI agent (auto-running collection)")

    # Arrow to transport (HTTPS)
    draw_arrow(c, cx + 220 + 6, cy + 60, center_x - 20, cy + 60)
    c.setFont("Helvetica-Oblique", 9)
    c.drawString((cx + 220 + center_x - 20)/2 - 10, cy + 66, "HTTPS / Encrypted")

    # TRANSPORT / API GATEWAY
    gx = center_x
    gy = cy
    draw_box(c, gx, gy, 180, 120, "API Gateway / Ingress", fill_color=colors.HexColor('#EAF2FF'), stroke_color=colors.HexColor('#5B9BD5'))
    c.setFont("Helvetica", 9)
    c.drawString(gx + 8, gy + 88, "- Auth & API key validation")
    c.drawString(gx + 8, gy + 72, "- Input validation & rate limiting")
    c.drawString(gx + 8, gy + 56, "- Routing to ingestion / chat / db")

    # Arrow to Brainbox Backend
    draw_arrow(c, gx + 180 + 6, gy + 60, right_x - 8, gy + 60)

    # BRAinbox BACKEND
    bx = right_x
    by = gy
    draw_box(c, bx, by, 260, 240, "Brainbox Backend", fill_color=colors.lightgrey, stroke_color=colors.black)

    # Inside backend: components
    comp_x = bx + 10
    comp_y = by + 200
    c.setFont("Helvetica-Bold", 10)
    c.drawString(comp_x, comp_y, "Core Components:")
    c.setFont("Helvetica", 9)
    c.drawString(comp_x, comp_y - 16, "- Ingestion Pipeline (chunking, dedupe)")
    c.drawString(comp_x, comp_y - 32, "- AI Agents (LangGraph workflows)")
    c.drawString(comp_x, comp_y - 48, "- Embeddings & Vector DB (pgvector)")
    c.drawString(comp_x, comp_y - 64, "- LLM Interface (Ollama / OpenAI)")
    c.drawString(comp_x, comp_y - 80, "- Database & Audit Logs")
    c.drawString(comp_x, comp_y - 96, "- Dashboard / Chat UI")

    # Draw arrows between backend components (stylized vertical)
    mid_x = bx + 20
    top = comp_y - 110
    bottom = by + 20
    c.setStrokeColor(colors.darkgrey)
    c.setLineWidth(1)
    c.line(mid_x, top, mid_x, bottom)
    # little labels
    c.setFont("Helvetica-Oblique", 8)
    c.drawString(mid_x + 6, (top + bottom)/2, "Processing & Storage")

    # SDKs row at bottom
    sx = MARGIN + 10
    sy = by - 80
    draw_box(c, sx, sy, PAGE_WIDTH - 2*MARGIN - 20, 60, "SDKs & Integrations (used by customers)", fill_color=colors.whitesmoke, stroke_color=colors.grey)
    c.setFont("Helvetica", 9)
    sdk_text = "Python SDK | Node SDK | React SDK (Next.js) | React Native (Mobile) | sdk-web (Odoo/plain web) | CLI agent | Database SDK"
    draw_wrapped_text(c, sdk_text, sx + 8, sy + 40, PAGE_WIDTH - 2*MARGIN - 36, font_size=9)

    # Arrows from SDKs up to API Gateway
    draw_arrow(c, sx + 120, sy + 60, gx + 40, gy)
    draw_arrow(c, sx + 360, sy + 60, gx + 80, gy)

    # Legend / Tech Stack box
    lx = bx
    ly = by - 100
    draw_box(c, lx, ly, 260, 72, "Technology Stack", fill_color=colors.HexColor('#FFF8E1'), stroke_color=colors.HexColor('#E6B800'))
    c.setFont("Helvetica", 8)
    lines = [
        "Web Framework: FastAPI", "DB: PostgreSQL (+pgvector)", "Cache/Queue: Redis, Celery",
        "Embeddings: SentenceTransformers", "LLM: Ollama / OpenAI", "ORM: SQLAlchemy"
    ]
    for i, ln in enumerate(lines):
        c.drawString(lx + 8, ly + 52 - i*12, f"- {ln}")

    # Footer note
    c.setFont("Helvetica-Oblique", 8)
    c.drawString(MARGIN, 10, "Diagram: high-level flow from customer SDKs → API Gateway → Brainbox backend (ingestion, AI agents, DB) → Dashboard")

    c.showPage()


def add_text_page(c, title, paragraphs):
    c.setFont("Helvetica-Bold", 16)
    c.drawString(MARGIN, PAGE_HEIGHT - MARGIN - 10, title)

    y = PAGE_HEIGHT - MARGIN - 40
    c.setFont("Helvetica", 10)
    leading = 14
    for para in paragraphs:
        lines = textwrap.wrap(para, width=110)
        for line in lines:
            if y < MARGIN + 20:
                c.showPage()
                c.setFont("Helvetica", 10)
                y = PAGE_HEIGHT - MARGIN - 20
            c.drawString(MARGIN, y, line)
            y -= leading
        y -= leading/2
    c.showPage()


def main():
    c = canvas.Canvas(OUT_PDF, pagesize=landscape(A4))

    draw_cover(c)
    draw_diagram(c)

    # SDKs & Features page
    title = "SDKs, Features & How it Works"
    paras = [
        "SDKs included: Python SDK, Node.js SDK, React SDK (for Next.js), React Native SDK for mobile, sdk-web for plain web and Odoo embedding, CLI agent for automatic log collection, and a Database SDK for safe read-only queries.",
        "How it works (flow): Customer apps and CLI collect logs or send queries using SDKs → Requests go over HTTPS to the API Gateway which handles auth, validation and rate limiting → Ingestion pipeline chunks and deduplicates data, stores embeddings and documents → AI Agents (LangGraph) and LLM interfaces analyze data and produce insights → Results stored in database (+audit logs) and surfaced via Dashboard and Chat endpoints.",
        "Database access: Customers use Database SDK which issues requests to the backend endpoints (/api/db/test-connection, /api/db/schema, /api/db/query, /api/db/audit-log). Backend enforces read-only, rate limits, tenant isolation, and logs all queries for auditing."
    ]
    add_text_page(c, title, paras)

    # Tech stack page
    title = "Technology Stack & Tools"
    paras = [
        "Core backend: FastAPI (Python), SQLAlchemy ORM, PostgreSQL with pgvector for embeddings, Redis for cache and Celery for background jobs.",
        "Embeddings: SentenceTransformers or other recommended embedding models; vector storage via pgvector. LLMs: Ollama for local inference and OpenAI for cloud inference; configurable per deployment.",
        "SDK & deployment tools: pip, npm for distribution; Docker and docker-compose for deployment; systemd/launchctl/Task Scheduler for running the CLI agent as a service. Monitoring via structured logs, tracing, and audit logs in DB.",
    ]
    add_text_page(c, title, paras)

    # Future ideas / roadmap
    title = "Roadmap Ideas & Suggested Features"
    paras = [
        "1) Mobile & Offline: Add offline buffering for mobile SDKs and background sync to handle intermittent connectivity; push notifications for high-severity alerts.",
        "2) Odoo Integration: Provide a ready-made Odoo module that embeds the chat widget and pre-configured endpoints for ingesting logs or business data from Odoo models.",
        "3) Real-time Streaming: Offer optional WebSocket or streaming ingestion for near-real-time observability and alerting.",
        "4) Fine-grained RBAC & Audit: Expand roles and exportable compliance reports; automated data retention rules per tenant.",
        "5) Analytics & Reports: Dashboard widgets for top queries, slow queries, trending errors, and user behavior metrics.",
        "6) Automated Remediation: Add playbooks for common issues and automated suggestions; integrate with incident management tools.",
    ]
    add_text_page(c, title, paras)

    # Appendix: Endpoints & Security
    title = "Appendix — Endpoints & Security Highlights"
    paras = [
        "Database endpoints (required): POST /api/db/test-connection, POST /api/db/schema, POST /api/db/query (read-only), GET /api/db/audit-log. Enforce: API key validation, tenant check, block forbidden SQL operations, rate limit, and audit all queries.",
        "Chat & ingest endpoints: POST /api/ingest, POST /api/chat, POST /api/chat/session, health endpoints at /api/health. Ensure HTTPS and API authentication for all endpoints. Use parameterized queries and sanitize outputs to avoid leaking secrets.",
    ]
    add_text_page(c, title, paras)

    c.save()
    print(f"PDF written to: {OUT_PDF}")


if __name__ == '__main__':
    main()

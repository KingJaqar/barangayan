#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""Generates an editable ERD SVG for the barangayan Supabase schema."""

import html

# ---------------------------------------------------------------------------
# Schema definition: (table_name, module, [(col_name, type_hint, flag), ...])
# flag: "PK", "FK", "PK/FK", "" (regular)
# ---------------------------------------------------------------------------

TABLES = [
    ("auth.users", "External (Supabase Auth)", [
        ("id", "uuid", "PK"),
        ("email", "text", ""),
        ("...", "(managed by Supabase Auth)", ""),
    ]),
    ("barangays", "Core / Multi-Tenant", [
        ("id", "uuid", "PK"),
        ("name", "text", ""),
        ("boundary", "jsonb", ""),
        ("config", "jsonb", ""),
        ("shipping_fee_centavos", "integer", ""),
        ("created_at", "timestamptz", ""),
        ("updated_at", "timestamptz", ""),
    ]),
    ("profiles", "Core / Multi-Tenant", [
        ("id", "uuid", "PK/FK -> auth.users"),
        ("barangay_id", "uuid", "FK -> barangays"),
        ("role", "text", ""),
        ("full_name", "text", ""),
        ("first_name", "text", ""),
        ("last_name", "text", ""),
        ("middle_name", "text", ""),
        ("suffix", "text", ""),
        ("mobile_number", "text", ""),
        ("home_address", "text", ""),
        ("house_no", "text", ""),
        ("street", "text", ""),
        ("city", "text", ""),
        ("sex", "text", ""),
        ("employment_status", "text", ""),
        ("occupation", "text", ""),
        ("birth_date", "date", ""),
        ("email", "text", ""),
        ("email_verification_status", "text", ""),
        ("email_verification_requested_at", "timestamptz", ""),
        ("email_verified_at", "timestamptz", ""),
        ("avatar_url", "text", ""),
        ("household_members", "jsonb", ""),
        ("id_photo_urls", "text[]", ""),
        ("id_type", "text", ""),
        ("id_verification_status", "text", ""),
        ("location_verified", "boolean", ""),
        ("registration_location", "jsonb", ""),
        ("theme_preference", "text", ""),
        ("accent_color", "text", ""),
        ("custom_accent_colors", "text[]", ""),
        ("font_preference", "text", ""),
        ("push_notifications_enabled", "boolean", ""),
        ("last_data_export_at", "timestamptz", ""),
        ("deleted_at", "timestamptz", ""),
        ("created_at", "timestamptz", ""),
        ("updated_at", "timestamptz", ""),
    ]),
    ("document_types", "Services", [
        ("id", "uuid", "PK"),
        ("barangay_id", "uuid", "FK -> barangays"),
        ("name", "text", ""),
        ("description", "text", ""),
        ("fee_centavos", "integer", ""),
        ("processing_target_hours", "integer", ""),
        ("requirements", "text[]", ""),
        ("is_active", "boolean", ""),
        ("deleted_at", "timestamptz", ""),
        ("created_at", "timestamptz", ""),
    ]),
    ("service_requests", "Services", [
        ("id", "uuid", "PK"),
        ("barangay_id", "uuid", "FK -> barangays"),
        ("resident_id", "uuid", "FK -> profiles"),
        ("document_type_id", "uuid", "FK -> document_types"),
        ("reference_number", "text", ""),
        ("requester_notes", "text", ""),
        ("status", "text", ""),
        ("payment_status", "text", ""),
        ("payment_method", "text", ""),
        ("status_history", "jsonb", ""),
        ("deleted_at", "timestamptz", ""),
        ("created_at", "timestamptz", ""),
        ("updated_at", "timestamptz", ""),
    ]),
    ("payments", "Services", [
        ("id", "uuid", "PK"),
        ("service_request_id", "uuid", "FK -> service_requests"),
        ("barangay_id", "uuid", "FK -> barangays"),
        ("method", "text", ""),
        ("amount_centavos", "integer", ""),
        ("document_fee_centavos", "integer", ""),
        ("shipping_fee_centavos", "integer", ""),
        ("status", "text", ""),
        ("paymongo_source_id", "text", ""),
        ("paymongo_payment_id", "text", ""),
        ("paymongo_payment_intent_id", "text", ""),
        ("qr_image_url", "text", ""),
        ("expires_at", "timestamptz", ""),
        ("paid_at", "timestamptz", ""),
        ("refund_status", "text", ""),
        ("refund_amount_centavos", "integer", ""),
        ("refund_reason", "text", ""),
        ("refund_transfer_link", "text", ""),
        ("refunded_at", "timestamptz", ""),
        ("refunded_by", "uuid", "FK -> profiles"),
        ("collected_by", "uuid", "FK -> profiles"),
        ("created_at", "timestamptz", ""),
        ("updated_at", "timestamptz", ""),
    ]),
    ("announcements", "Announcements", [
        ("id", "uuid", "PK"),
        ("barangay_id", "uuid", "FK -> barangays"),
        ("title", "text", ""),
        ("body", "text", ""),
        ("detailed_description", "text", ""),
        ("category", "text", ""),
        ("image_url", "text", ""),
        ("published_at", "timestamptz", ""),
        ("created_by", "uuid", "FK -> profiles"),
        ("created_at", "timestamptz", ""),
    ]),
    ("announcement_reads", "Announcements", [
        ("resident_id", "uuid", "PK/FK -> profiles"),
        ("announcement_id", "uuid", "PK/FK -> announcements"),
        ("read_at", "timestamptz", ""),
    ]),
    ("incident_categories", "Maps & Incidents", [
        ("id", "uuid", "PK"),
        ("barangay_id", "uuid", "FK -> barangays"),
        ("name", "text", ""),
        ("color", "text", ""),
        ("icon", "text", ""),
        ("is_trash_related", "boolean", ""),
        ("created_at", "timestamptz", ""),
    ]),
    ("incidents", "Maps & Incidents", [
        ("id", "uuid", "PK"),
        ("barangay_id", "uuid", "FK -> barangays"),
        ("reporter_id", "uuid", "FK -> profiles"),
        ("category_id", "uuid", "FK -> incident_categories"),
        ("zone_id", "uuid", "FK -> waste_zones"),
        ("title", "text", ""),
        ("description", "text", ""),
        ("location", "jsonb", ""),
        ("address", "text", ""),
        ("specific_area_details", "text", ""),
        ("photo_urls", "text[]", ""),
        ("status", "text", ""),
        ("confirmation_count", "integer", ""),
        ("resolved_read_at", "timestamptz", ""),
        ("deleted_at", "timestamptz", ""),
        ("created_at", "timestamptz", ""),
        ("updated_at", "timestamptz", ""),
    ]),
    ("incident_confirmations", "Maps & Incidents", [
        ("incident_id", "uuid", "PK/FK -> incidents"),
        ("user_id", "uuid", "PK/FK -> profiles"),
        ("created_at", "timestamptz", ""),
    ]),
    ("evacuation_centers", "Maps & Incidents", [
        ("id", "uuid", "PK"),
        ("barangay_id", "uuid", "FK -> barangays"),
        ("name", "text", ""),
        ("address", "text", ""),
        ("position", "jsonb", ""),
        ("capacity", "integer", ""),
        ("current_occupancy", "integer", ""),
        ("is_active", "boolean", ""),
        ("verified", "boolean", ""),
        ("contact_number", "text", ""),
        ("facilities", "text[]", ""),
        ("deleted_at", "timestamptz", ""),
        ("created_at", "timestamptz", ""),
        ("updated_at", "timestamptz", ""),
    ]),
    ("evacuation_center_checkins", "Maps & Incidents", [
        ("id", "uuid", "PK"),
        ("evacuation_center_id", "uuid", "FK -> evacuation_centers"),
        ("user_id", "uuid", "FK -> profiles"),
        ("barangay_id", "uuid", "FK -> barangays"),
        ("checked_in_at", "timestamptz", ""),
        ("created_at", "timestamptz", ""),
    ]),
    ("evacuation_center_qr_codes", "Maps & Incidents", [
        ("id", "uuid", "PK"),
        ("evacuation_center_id", "uuid", "FK -> evacuation_centers"),
        ("qr_payload", "jsonb", ""),
        ("qr_image_url", "text", ""),
        ("is_active", "boolean", ""),
        ("created_at", "timestamptz", ""),
        ("updated_at", "timestamptz", ""),
    ]),
    ("medical_drives", "Health", [
        ("id", "uuid", "PK"),
        ("barangay_id", "uuid", "FK -> barangays"),
        ("title", "text", ""),
        ("type", "drive_type (enum)", ""),
        ("drive_date", "date", ""),
        ("time_start", "time", ""),
        ("time_end", "time", ""),
        ("location", "text", ""),
        ("eligible_criteria", "text", ""),
        ("stock_label", "text", ""),
        ("stock_unit", "text", ""),
        ("stock_total", "integer", ""),
        ("stock_remaining", "integer", ""),
        ("is_active", "boolean", ""),
        ("deleted_at", "timestamptz", ""),
        ("created_at", "timestamptz", ""),
        ("updated_at", "timestamptz", ""),
    ]),
    ("drive_registrations", "Health", [
        ("id", "uuid", "PK"),
        ("drive_id", "uuid", "FK -> medical_drives"),
        ("user_id", "uuid", "FK -> auth.users"),
        ("applicant_number", "text", ""),
        ("age", "integer", ""),
        ("is_pwd", "boolean", ""),
        ("comorbidities", "text[]", ""),
        ("prior_dose_date", "date", ""),
        ("priority_score", "numeric", ""),
        ("status", "drive_registration_status (enum)", ""),
        ("created_at", "timestamptz", ""),
        ("updated_at", "timestamptz", ""),
    ]),
    ("household_members", "Health / Emergency", [
        ("id", "uuid", "PK"),
        ("profile_id", "uuid", "FK -> profiles"),
        ("name", "text", ""),
        ("relation", "text", ""),
        ("role", "text", ""),
        ("avatar_url", "text", ""),
        ("is_checked_in", "boolean", ""),
        ("checked_in_at", "timestamptz", ""),
        ("checked_in_center_id", "uuid", "FK -> evacuation_centers"),
        ("checked_in_center_name", "text", ""),
        ("sort_order", "integer", ""),
        ("created_at", "timestamptz", ""),
        ("updated_at", "timestamptz", ""),
    ]),
    ("emergency_information", "Emergency / DRRM", [
        ("id", "uuid", "PK"),
        ("barangay_id", "uuid", "FK -> barangays"),
        ("category", "text", ""),
        ("title", "text", ""),
        ("body", "text", ""),
        ("content", "jsonb", ""),
        ("icon", "text", ""),
        ("icon_color", "text", ""),
        ("icon_bg", "text", ""),
        ("sort_order", "integer", ""),
        ("is_active", "boolean", ""),
        ("published_at", "timestamptz", ""),
        ("created_by", "uuid", "FK -> profiles"),
        ("deleted_at", "timestamptz", ""),
        ("created_at", "timestamptz", ""),
    ]),
    ("emergency_qr_content", "Emergency / DRRM", [
        ("id", "uuid", "PK"),
        ("barangay_id", "uuid", "FK -> barangays"),
        ("section", "text", ""),
        ("title", "text", ""),
        ("body", "text", ""),
        ("content", "jsonb", ""),
        ("icon", "text", ""),
        ("icon_color", "text", ""),
        ("icon_bg", "text", ""),
        ("is_active", "boolean", ""),
        ("sort_order", "integer", ""),
        ("deleted_at", "timestamptz", ""),
        ("created_at", "timestamptz", ""),
        ("updated_at", "timestamptz", ""),
    ]),
    ("waste_zones", "Waste Management", [
        ("id", "uuid", "PK"),
        ("barangay_id", "uuid", "FK -> barangays"),
        ("name", "text", ""),
        ("description", "text", ""),
        ("is_active", "boolean", ""),
        ("sort_order", "integer", ""),
        ("trash_score", "numeric", ""),
        ("trash_score_updated_at", "timestamptz", ""),
        ("deleted_at", "timestamptz", ""),
        ("created_at", "timestamptz", ""),
        ("updated_at", "timestamptz", ""),
    ]),
    ("waste_collection_schedules", "Waste Management", [
        ("id", "uuid", "PK"),
        ("barangay_id", "uuid", "FK -> barangays"),
        ("zone_id", "uuid", "FK -> waste_zones"),
        ("waste_type", "text", ""),
        ("day_of_week", "integer", ""),
        ("start_time", "time", ""),
        ("end_time", "time", ""),
        ("notes", "text", ""),
        ("is_active", "boolean", ""),
        ("sort_order", "integer", ""),
        ("deleted_at", "timestamptz", ""),
        ("created_at", "timestamptz", ""),
        ("updated_at", "timestamptz", ""),
    ]),
    ("faq_articles", "Content / Admin", [
        ("id", "uuid", "PK"),
        ("barangay_id", "uuid", "FK -> barangays"),
        ("question", "text", ""),
        ("answer", "text", ""),
        ("category", "text", ""),
        ("is_active", "boolean", ""),
        ("sort_order", "integer", ""),
        ("deleted_at", "timestamptz", ""),
        ("created_at", "timestamptz", ""),
        ("updated_at", "timestamptz", ""),
    ]),
    ("barangay_officials", "Content / Admin", [
        ("id", "uuid", "PK"),
        ("profile_id", "uuid", "FK -> profiles"),
        ("barangay_id", "uuid", "FK -> barangays"),
        ("official_role", "text", ""),
        ("is_active", "boolean", ""),
        ("date_hired", "date", ""),
        ("notes", "text", ""),
        ("deleted_at", "timestamptz", ""),
        ("created_at", "timestamptz", ""),
        ("updated_at", "timestamptz", ""),
    ]),
    ("admin_audit_log", "Content / Admin", [
        ("id", "uuid", "PK"),
        ("barangay_id", "uuid", "FK -> barangays"),
        ("admin_id", "uuid", "FK -> auth.users"),
        ("action", "text", ""),
        ("entity_type", "text", ""),
        ("entity_id", "uuid", ""),
        ("entity_label", "text", ""),
        ("changes", "jsonb", ""),
        ("metadata", "jsonb", ""),
        ("is_read", "boolean", ""),
        ("created_at", "timestamptz", ""),
    ]),
    ("site_content", "Content / Admin", [
        ("id", "uuid", "PK"),
        ("barangay_id", "uuid", "FK -> barangays"),
        ("section", "text", ""),
        ("title", "text", ""),
        ("body", "text", ""),
        ("is_active", "boolean", ""),
        ("sort_order", "integer", ""),
        ("deleted_at", "timestamptz", ""),
        ("created_at", "timestamptz", ""),
        ("updated_at", "timestamptz", ""),
    ]),
    ("about_us", "Content / Admin", [
        ("id", "uuid", "PK"),
        ("barangay_id", "uuid", "FK -> barangays"),
        ("mission", "text", ""),
        ("vision", "text", ""),
        ("history", "text", ""),
        ("contact_email", "text", ""),
        ("contact_phone", "text", ""),
        ("address", "text", ""),
        ("logo_url", "text", ""),
        ("is_active", "boolean", ""),
        ("sort_order", "integer", ""),
        ("deleted_at", "timestamptz", ""),
        ("created_at", "timestamptz", ""),
        ("updated_at", "timestamptz", ""),
    ]),
    ("developer_profiles", "Content / Admin", [
        ("id", "uuid", "PK"),
        ("about_us_id", "uuid", "FK -> about_us"),
        ("barangay_id", "uuid", "FK -> barangays"),
        ("name", "text", ""),
        ("role", "text", ""),
        ("bio", "text", ""),
        ("photo_url", "text", ""),
        ("sort_order", "integer", ""),
        ("deleted_at", "timestamptz", ""),
        ("created_at", "timestamptz", ""),
        ("updated_at", "timestamptz", ""),
    ]),
    ("push_tokens", "Content / Admin", [
        ("id", "uuid", "PK"),
        ("user_id", "uuid", "FK -> auth.users"),
        ("expo_push_token", "text", ""),
        ("device_type", "text", ""),
        ("last_used_at", "timestamptz", ""),
        ("created_at", "timestamptz", ""),
    ]),
]

# Explicit FK edges: (from_table, to_table)
EDGES = [
    ("profiles", "auth.users"),
    ("profiles", "barangays"),
    ("document_types", "barangays"),
    ("service_requests", "barangays"),
    ("service_requests", "profiles"),
    ("service_requests", "document_types"),
    ("payments", "service_requests"),
    ("payments", "barangays"),
    ("payments", "profiles"),
    ("announcements", "barangays"),
    ("announcements", "profiles"),
    ("announcement_reads", "profiles"),
    ("announcement_reads", "announcements"),
    ("incident_categories", "barangays"),
    ("incidents", "barangays"),
    ("incidents", "profiles"),
    ("incidents", "incident_categories"),
    ("incidents", "waste_zones"),
    ("incident_confirmations", "incidents"),
    ("incident_confirmations", "profiles"),
    ("evacuation_centers", "barangays"),
    ("evacuation_center_checkins", "evacuation_centers"),
    ("evacuation_center_checkins", "profiles"),
    ("evacuation_center_checkins", "barangays"),
    ("evacuation_center_qr_codes", "evacuation_centers"),
    ("medical_drives", "barangays"),
    ("drive_registrations", "medical_drives"),
    ("drive_registrations", "auth.users"),
    ("household_members", "profiles"),
    ("household_members", "evacuation_centers"),
    ("emergency_information", "barangays"),
    ("emergency_information", "profiles"),
    ("emergency_qr_content", "barangays"),
    ("waste_zones", "barangays"),
    ("waste_collection_schedules", "barangays"),
    ("waste_collection_schedules", "waste_zones"),
    ("faq_articles", "barangays"),
    ("barangay_officials", "profiles"),
    ("barangay_officials", "barangays"),
    ("admin_audit_log", "barangays"),
    ("admin_audit_log", "auth.users"),
    ("site_content", "barangays"),
    ("about_us", "barangays"),
    ("developer_profiles", "about_us"),
    ("developer_profiles", "barangays"),
    ("push_tokens", "auth.users"),
]

# ---------------------------------------------------------------------------
# Layout: group tables by module, arrange into columns per module, flowing
# top-to-bottom within a column, columns left-to-right.
# ---------------------------------------------------------------------------

MODULE_ORDER = [
    "External (Supabase Auth)",
    "Core / Multi-Tenant",
    "Services",
    "Announcements",
    "Maps & Incidents",
    "Health",
    "Health / Emergency",
    "Emergency / DRRM",
    "Waste Management",
    "Content / Admin",
]

MODULE_COLORS = {
    "External (Supabase Auth)": ("#4b5563", "#f3f4f6"),
    "Core / Multi-Tenant":      ("#7c3aed", "#f1e9fe"),
    "Services":                 ("#0f6e5b", "#e6f2ef"),
    "Announcements":            ("#b45309", "#fdf1e0"),
    "Maps & Incidents":         ("#dc2626", "#fde8e8"),
    "Health":                   ("#0891b2", "#e0f6fa"),
    "Health / Emergency":       ("#0891b2", "#e0f6fa"),
    "Emergency / DRRM":         ("#c2410c", "#fde9dc"),
    "Waste Management":         ("#65a30d", "#eef7e0"),
    "Content / Admin":          ("#334155", "#e7ebf0"),
}

COL_WIDTH = 300
COL_GAP = 90
ROW_GAP = 60
HEADER_H = 34
MODULE_LABEL_H = 30
ROW_H = 18
PAD_TOP = 8
PAD_BOTTOM = 8
MARGIN = 60

def table_height(cols):
    return HEADER_H + PAD_TOP + PAD_BOTTOM + ROW_H * len(cols)

# group tables by module, preserving TABLES order within module
by_module = {}
for t in TABLES:
    by_module.setdefault(t[1], []).append(t)

# Build columns: one column per module (module label at top of its column)
columns = []
for mod in MODULE_ORDER:
    if mod in by_module:
        columns.append((mod, by_module[mod]))

positions = {}  # table_name -> (x, y, w, h)
col_x = MARGIN
col_widths = []
total_height = 0

for mod, tables in columns:
    y = MARGIN + MODULE_LABEL_H
    for t in tables:
        name, module, cols = t
        h = table_height(cols)
        positions[name] = (col_x, y, COL_WIDTH, h)
        y += h + ROW_GAP
    col_widths.append(COL_WIDTH)
    total_height = max(total_height, y)
    col_x += COL_WIDTH + COL_GAP

canvas_w = col_x - COL_GAP + MARGIN
TITLE_OFFSET = 70
LEGEND_SPACE = 60
canvas_h = total_height + MARGIN + TITLE_OFFSET + LEGEND_SPACE

def shift(y):
    return y + TITLE_OFFSET

# ---------------------------------------------------------------------------
# SVG generation
# ---------------------------------------------------------------------------

def esc(s):
    return html.escape(str(s), quote=True)

svg_parts = []
svg_parts.append(f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {canvas_w} {canvas_h}" '
                  f'width="{canvas_w}" height="{canvas_h}" font-family="Verdana, Arial, sans-serif">')

# background
svg_parts.append(f'<rect x="0" y="0" width="{canvas_w}" height="{canvas_h}" fill="#ffffff"/>')

# Title
svg_parts.append(f'<text x="{MARGIN}" y="34" font-size="26" font-weight="bold" fill="#111827">Barangayan &#8212; Full Database Schema (ERD)</text>')
svg_parts.append(f'<text x="{MARGIN}" y="54" font-size="13" fill="#6b7280">Generated from supabase/migrations &#8212; {len(TABLES)} tables, grouped by module. PK = primary key, FK = foreign key.</text>')

# Module column labels
for mod, tables in columns:
    x, y0, w, h0 = positions[tables[0][0]]
    label_y = shift(MARGIN)
    stroke, fill = MODULE_COLORS.get(mod, ("#374151", "#f3f4f6"))
    svg_parts.append(f'<rect x="{x}" y="{label_y}" width="{COL_WIDTH}" height="24" rx="4" fill="{stroke}"/>')
    svg_parts.append(f'<text x="{x + COL_WIDTH/2}" y="{label_y + 17}" font-size="13" font-weight="bold" '
                      f'fill="#ffffff" text-anchor="middle">{esc(mod.upper())}</text>')

# Draw edges first (so boxes sit above lines), using simple elbow connectors
# between right/left/top/bottom edges of boxes based on relative column position.
def edge_point(name, side):
    x, y, w, h = positions[name]
    y = shift(y)
    if side == "right":
        return (x + w, y + h / 2)
    if side == "left":
        return (x, y + h / 2)
    if side == "top":
        return (x + w / 2, y)
    if side == "bottom":
        return (x + w / 2, y + h)

col_index = {}
for i, (mod, tables) in enumerate(columns):
    for t in tables:
        col_index[t[0]] = i

for a, b in EDGES:
    if a not in positions or b not in positions:
        continue
    ca, cb = col_index[a], col_index[b]
    if ca == cb:
        # same column: connect bottom of the higher one to top of lower one, offset to the side
        ax, ay, aw, ah = positions[a]
        bx, by, bw, bh = positions[b]
        if ay < by:
            p1 = edge_point(a, "right")
            p2 = edge_point(b, "right")
        else:
            p1 = edge_point(b, "right")
            p2 = edge_point(a, "right")
        mx = p1[0] + 26
        path = f'M {p1[0]:.1f} {p1[1]:.1f} C {mx:.1f} {p1[1]:.1f}, {mx:.1f} {p2[1]:.1f}, {p2[0]:.1f} {p2[1]:.1f}'
    elif ca < cb:
        p1 = edge_point(a, "left")
        p2 = edge_point(b, "right")
        mx = (p1[0] + p2[0]) / 2
        path = f'M {p1[0]:.1f} {p1[1]:.1f} C {mx:.1f} {p1[1]:.1f}, {mx:.1f} {p2[1]:.1f}, {p2[0]:.1f} {p2[1]:.1f}'
    else:
        p1 = edge_point(a, "right")
        p2 = edge_point(b, "left")
        mx = (p1[0] + p2[0]) / 2
        path = f'M {p1[0]:.1f} {p1[1]:.1f} C {mx:.1f} {p1[1]:.1f}, {mx:.1f} {p2[1]:.1f}, {p2[0]:.1f} {p2[1]:.1f}'
    svg_parts.append(f'<path d="{path}" fill="none" stroke="#c7ccd4" stroke-width="1.4"/>')

# Draw table boxes
for name, module, cols in TABLES:
    x, y, w, h = positions[name]
    y = shift(y)
    stroke, fill = MODULE_COLORS.get(module, ("#374151", "#f3f4f6"))

    svg_parts.append(f'<g>')
    # outer box
    svg_parts.append(f'<rect x="{x}" y="{y}" width="{w}" height="{h}" rx="6" '
                      f'fill="#ffffff" stroke="{stroke}" stroke-width="1.5"/>')
    # header
    svg_parts.append(f'<rect x="{x}" y="{y}" width="{w}" height="{HEADER_H}" rx="6" fill="{stroke}"/>')
    svg_parts.append(f'<rect x="{x}" y="{y + HEADER_H - 8}" width="{w}" height="8" fill="{stroke}"/>')
    svg_parts.append(f'<text x="{x + 10}" y="{y + 22}" font-size="14" font-weight="bold" fill="#ffffff">{esc(name)}</text>')

    row_y = y + HEADER_H + PAD_TOP
    for i, (col_name, col_type, flag) in enumerate(cols):
        ry = row_y + i * ROW_H
        # zebra striping
        if i % 2 == 1:
            svg_parts.append(f'<rect x="{x}" y="{ry}" width="{w}" height="{ROW_H}" fill="{fill}" opacity="0.5"/>')
        name_weight = "bold" if flag else "normal"
        name_color = "#111827" if not flag else ("#7c3aed" if "PK" in flag else "#1d4ed8")
        badge = ""
        if flag == "PK":
            badge = "PK"
        elif flag.startswith("PK/FK"):
            badge = "PK,FK"
        elif flag.startswith("FK"):
            badge = "FK"
        svg_parts.append(f'<text x="{x + 10}" y="{ry + 13}" font-size="11.5" font-weight="{name_weight}" '
                          f'fill="{name_color}">{esc(col_name)}</text>')
        svg_parts.append(f'<text x="{x + w - 10}" y="{ry + 13}" font-size="10" fill="#6b7280" text-anchor="end">{esc(col_type)}</text>')
        if badge:
            svg_parts.append(f'<text x="{x + 130}" y="{ry + 13}" font-size="9.5" font-weight="bold" fill="{stroke}">{esc(badge)}</text>')
        if flag and "->" in flag:
            ref = flag.split("->", 1)[1].strip()
            svg_parts.append(f'<title>{esc(col_name)} references {esc(ref)}</title>')
    svg_parts.append('</g>')

# Legend
legend_y = shift(MARGIN) - 0
lx = MARGIN
ly = canvas_h - 46
svg_parts.append(f'<rect x="{lx}" y="{ly}" width="620" height="34" rx="6" fill="#f9fafb" stroke="#e5e7eb"/>')
svg_parts.append(f'<text x="{lx+12}" y="{ly+21}" font-size="11.5" fill="#374151">'
                  f'<tspan font-weight="bold" fill="#7c3aed">PK</tspan> = Primary Key &#160;&#160; '
                  f'<tspan font-weight="bold" fill="#1d4ed8">FK</tspan> = Foreign Key &#160;&#160; '
                  f'Lines = foreign-key relationships &#160;&#160; Colors = feature module'
                  f'</text>')

svg_parts.append('</svg>')

svg = "\n".join(svg_parts)

with open(r"C:\Users\User\barangayan\.scratch\barangayan_erd.svg", "w", encoding="utf-8") as f:
    f.write(svg)

print("Tables:", len(TABLES))
print("Canvas:", canvas_w, "x", canvas_h)
print("Written to .scratch/barangayan_erd.svg")

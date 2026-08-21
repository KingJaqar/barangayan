#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""Generates a Mermaid erDiagram for the barangayan Supabase schema."""

TABLES = [
    ("auth_users", [("id", "uuid", "PK"), ("email", "text", "")]),
    ("barangays", [("id", "uuid", "PK"), ("name", "text", ""), ("boundary", "jsonb", ""), ("config", "jsonb", ""),
        ("shipping_fee_centavos", "integer", ""), ("created_at", "timestamptz", ""), ("updated_at", "timestamptz", "")]),
    ("profiles", [("id", "uuid", "PK"), ("barangay_id", "uuid", "FK"), ("role", "text", ""), ("full_name", "text", ""),
        ("first_name", "text", ""), ("last_name", "text", ""), ("middle_name", "text", ""), ("suffix", "text", ""),
        ("mobile_number", "text", ""), ("home_address", "text", ""), ("house_no", "text", ""), ("street", "text", ""),
        ("city", "text", ""), ("sex", "text", ""), ("employment_status", "text", ""), ("occupation", "text", ""),
        ("birth_date", "date", ""), ("email", "text", ""), ("email_verification_status", "text", ""),
        ("email_verification_requested_at", "timestamptz", ""), ("email_verified_at", "timestamptz", ""),
        ("avatar_url", "text", ""), ("household_members", "jsonb", ""), ("id_photo_urls", "text_array", ""),
        ("id_type", "text", ""), ("id_verification_status", "text", ""), ("location_verified", "boolean", ""),
        ("registration_location", "jsonb", ""), ("theme_preference", "text", ""), ("accent_color", "text", ""),
        ("custom_accent_colors", "text_array", ""), ("font_preference", "text", ""),
        ("push_notifications_enabled", "boolean", ""), ("last_data_export_at", "timestamptz", ""),
        ("deleted_at", "timestamptz", ""), ("created_at", "timestamptz", ""), ("updated_at", "timestamptz", "")]),
    ("document_types", [("id", "uuid", "PK"), ("barangay_id", "uuid", "FK"), ("name", "text", ""), ("description", "text", ""),
        ("fee_centavos", "integer", ""), ("processing_target_hours", "integer", ""), ("requirements", "text_array", ""),
        ("is_active", "boolean", ""), ("deleted_at", "timestamptz", ""), ("created_at", "timestamptz", "")]),
    ("service_requests", [("id", "uuid", "PK"), ("barangay_id", "uuid", "FK"), ("resident_id", "uuid", "FK"),
        ("document_type_id", "uuid", "FK"), ("reference_number", "text", ""), ("requester_notes", "text", ""),
        ("status", "text", ""), ("payment_status", "text", ""), ("payment_method", "text", ""),
        ("status_history", "jsonb", ""), ("deleted_at", "timestamptz", ""), ("created_at", "timestamptz", ""),
        ("updated_at", "timestamptz", "")]),
    ("payments", [("id", "uuid", "PK"), ("service_request_id", "uuid", "FK"), ("barangay_id", "uuid", "FK"),
        ("method", "text", ""), ("amount_centavos", "integer", ""), ("document_fee_centavos", "integer", ""),
        ("shipping_fee_centavos", "integer", ""), ("status", "text", ""), ("paymongo_source_id", "text", ""),
        ("paymongo_payment_id", "text", ""), ("paymongo_payment_intent_id", "text", ""), ("qr_image_url", "text", ""),
        ("expires_at", "timestamptz", ""), ("paid_at", "timestamptz", ""), ("refund_status", "text", ""),
        ("refund_amount_centavos", "integer", ""), ("refund_reason", "text", ""), ("refund_transfer_link", "text", ""),
        ("refunded_at", "timestamptz", ""), ("refunded_by", "uuid", "FK"), ("collected_by", "uuid", "FK"),
        ("created_at", "timestamptz", ""), ("updated_at", "timestamptz", "")]),
    ("announcements", [("id", "uuid", "PK"), ("barangay_id", "uuid", "FK"), ("title", "text", ""), ("body", "text", ""),
        ("detailed_description", "text", ""), ("category", "text", ""), ("image_url", "text", ""),
        ("published_at", "timestamptz", ""), ("created_by", "uuid", "FK"), ("created_at", "timestamptz", "")]),
    ("announcement_reads", [("resident_id", "uuid", "PK_FK"), ("announcement_id", "uuid", "PK_FK"),
        ("read_at", "timestamptz", "")]),
    ("incident_categories", [("id", "uuid", "PK"), ("barangay_id", "uuid", "FK"), ("name", "text", ""), ("color", "text", ""),
        ("icon", "text", ""), ("is_trash_related", "boolean", ""), ("created_at", "timestamptz", "")]),
    ("incidents", [("id", "uuid", "PK"), ("barangay_id", "uuid", "FK"), ("reporter_id", "uuid", "FK"),
        ("category_id", "uuid", "FK"), ("zone_id", "uuid", "FK"), ("title", "text", ""), ("description", "text", ""),
        ("location", "jsonb", ""), ("address", "text", ""), ("specific_area_details", "text", ""),
        ("photo_urls", "text_array", ""), ("status", "text", ""), ("confirmation_count", "integer", ""),
        ("resolved_read_at", "timestamptz", ""), ("deleted_at", "timestamptz", ""), ("created_at", "timestamptz", ""),
        ("updated_at", "timestamptz", "")]),
    ("incident_confirmations", [("incident_id", "uuid", "PK_FK"), ("user_id", "uuid", "PK_FK"),
        ("created_at", "timestamptz", "")]),
    ("evacuation_centers", [("id", "uuid", "PK"), ("barangay_id", "uuid", "FK"), ("name", "text", ""), ("address", "text", ""),
        ("position", "jsonb", ""), ("capacity", "integer", ""), ("current_occupancy", "integer", ""),
        ("is_active", "boolean", ""), ("verified", "boolean", ""), ("contact_number", "text", ""),
        ("facilities", "text_array", ""), ("deleted_at", "timestamptz", ""), ("created_at", "timestamptz", ""),
        ("updated_at", "timestamptz", "")]),
    ("evacuation_center_checkins", [("id", "uuid", "PK"), ("evacuation_center_id", "uuid", "FK"),
        ("user_id", "uuid", "FK"), ("barangay_id", "uuid", "FK"), ("checked_in_at", "timestamptz", ""),
        ("created_at", "timestamptz", "")]),
    ("evacuation_center_qr_codes", [("id", "uuid", "PK"), ("evacuation_center_id", "uuid", "FK"),
        ("qr_payload", "jsonb", ""), ("qr_image_url", "text", ""), ("is_active", "boolean", ""),
        ("created_at", "timestamptz", ""), ("updated_at", "timestamptz", "")]),
    ("medical_drives", [("id", "uuid", "PK"), ("barangay_id", "uuid", "FK"), ("title", "text", ""), ("type", "enum", ""),
        ("drive_date", "date", ""), ("time_start", "time", ""), ("time_end", "time", ""), ("location", "text", ""),
        ("eligible_criteria", "text", ""), ("stock_label", "text", ""), ("stock_unit", "text", ""),
        ("stock_total", "integer", ""), ("stock_remaining", "integer", ""), ("is_active", "boolean", ""),
        ("deleted_at", "timestamptz", ""), ("created_at", "timestamptz", ""), ("updated_at", "timestamptz", "")]),
    ("drive_registrations", [("id", "uuid", "PK"), ("drive_id", "uuid", "FK"), ("user_id", "uuid", "FK"),
        ("applicant_number", "text", ""), ("age", "integer", ""), ("is_pwd", "boolean", ""),
        ("comorbidities", "text_array", ""), ("prior_dose_date", "date", ""), ("priority_score", "numeric", ""),
        ("status", "enum", ""), ("created_at", "timestamptz", ""), ("updated_at", "timestamptz", "")]),
    ("household_members", [("id", "uuid", "PK"), ("profile_id", "uuid", "FK"), ("name", "text", ""),
        ("relation", "text", ""), ("role", "text", ""), ("avatar_url", "text", ""), ("is_checked_in", "boolean", ""),
        ("checked_in_at", "timestamptz", ""), ("checked_in_center_id", "uuid", "FK"),
        ("checked_in_center_name", "text", ""), ("sort_order", "integer", ""), ("created_at", "timestamptz", ""),
        ("updated_at", "timestamptz", "")]),
    ("emergency_information", [("id", "uuid", "PK"), ("barangay_id", "uuid", "FK"), ("category", "text", ""),
        ("title", "text", ""), ("body", "text", ""), ("content", "jsonb", ""), ("icon", "text", ""),
        ("icon_color", "text", ""), ("icon_bg", "text", ""), ("sort_order", "integer", ""), ("is_active", "boolean", ""),
        ("published_at", "timestamptz", ""), ("created_by", "uuid", "FK"), ("deleted_at", "timestamptz", ""),
        ("created_at", "timestamptz", "")]),
    ("emergency_qr_content", [("id", "uuid", "PK"), ("barangay_id", "uuid", "FK"), ("section", "text", ""),
        ("title", "text", ""), ("body", "text", ""), ("content", "jsonb", ""), ("icon", "text", ""),
        ("icon_color", "text", ""), ("icon_bg", "text", ""), ("is_active", "boolean", ""), ("sort_order", "integer", ""),
        ("deleted_at", "timestamptz", ""), ("created_at", "timestamptz", ""), ("updated_at", "timestamptz", "")]),
    ("waste_zones", [("id", "uuid", "PK"), ("barangay_id", "uuid", "FK"), ("name", "text", ""), ("description", "text", ""),
        ("is_active", "boolean", ""), ("sort_order", "integer", ""), ("trash_score", "numeric", ""),
        ("trash_score_updated_at", "timestamptz", ""), ("deleted_at", "timestamptz", ""),
        ("created_at", "timestamptz", ""), ("updated_at", "timestamptz", "")]),
    ("waste_collection_schedules", [("id", "uuid", "PK"), ("barangay_id", "uuid", "FK"), ("zone_id", "uuid", "FK"),
        ("waste_type", "text", ""), ("day_of_week", "integer", ""), ("start_time", "time", ""), ("end_time", "time", ""),
        ("notes", "text", ""), ("is_active", "boolean", ""), ("sort_order", "integer", ""),
        ("deleted_at", "timestamptz", ""), ("created_at", "timestamptz", ""), ("updated_at", "timestamptz", "")]),
    ("faq_articles", [("id", "uuid", "PK"), ("barangay_id", "uuid", "FK"), ("question", "text", ""),
        ("answer", "text", ""), ("category", "text", ""), ("is_active", "boolean", ""), ("sort_order", "integer", ""),
        ("deleted_at", "timestamptz", ""), ("created_at", "timestamptz", ""), ("updated_at", "timestamptz", "")]),
    ("barangay_officials", [("id", "uuid", "PK"), ("profile_id", "uuid", "FK"), ("barangay_id", "uuid", "FK"),
        ("official_role", "text", ""), ("is_active", "boolean", ""), ("date_hired", "date", ""), ("notes", "text", ""),
        ("deleted_at", "timestamptz", ""), ("created_at", "timestamptz", ""), ("updated_at", "timestamptz", "")]),
    ("admin_audit_log", [("id", "uuid", "PK"), ("barangay_id", "uuid", "FK"), ("admin_id", "uuid", "FK"),
        ("action", "text", ""), ("entity_type", "text", ""), ("entity_id", "uuid", ""), ("entity_label", "text", ""),
        ("changes", "jsonb", ""), ("metadata", "jsonb", ""), ("is_read", "boolean", ""), ("created_at", "timestamptz", "")]),
    ("site_content", [("id", "uuid", "PK"), ("barangay_id", "uuid", "FK"), ("section", "text", ""), ("title", "text", ""),
        ("body", "text", ""), ("is_active", "boolean", ""), ("sort_order", "integer", ""),
        ("deleted_at", "timestamptz", ""), ("created_at", "timestamptz", ""), ("updated_at", "timestamptz", "")]),
    ("about_us", [("id", "uuid", "PK"), ("barangay_id", "uuid", "FK"), ("mission", "text", ""), ("vision", "text", ""),
        ("history", "text", ""), ("contact_email", "text", ""), ("contact_phone", "text", ""), ("address", "text", ""),
        ("logo_url", "text", ""), ("is_active", "boolean", ""), ("sort_order", "integer", ""),
        ("deleted_at", "timestamptz", ""), ("created_at", "timestamptz", ""), ("updated_at", "timestamptz", "")]),
    ("developer_profiles", [("id", "uuid", "PK"), ("about_us_id", "uuid", "FK"), ("barangay_id", "uuid", "FK"),
        ("name", "text", ""), ("role", "text", ""), ("bio", "text", ""), ("photo_url", "text", ""),
        ("sort_order", "integer", ""), ("deleted_at", "timestamptz", ""), ("created_at", "timestamptz", ""),
        ("updated_at", "timestamptz", "")]),
    ("push_tokens", [("id", "uuid", "PK"), ("user_id", "uuid", "FK"), ("expo_push_token", "text", ""),
        ("device_type", "text", ""), ("last_used_at", "timestamptz", ""), ("created_at", "timestamptz", "")]),
]

EDGES = [
    ("profiles", "auth_users", "id"),
    ("profiles", "barangays", "barangay_id"),
    ("document_types", "barangays", "barangay_id"),
    ("service_requests", "barangays", "barangay_id"),
    ("service_requests", "profiles", "resident_id"),
    ("service_requests", "document_types", "document_type_id"),
    ("payments", "service_requests", "service_request_id"),
    ("payments", "barangays", "barangay_id"),
    ("payments", "profiles", "collected_by_refunded_by"),
    ("announcements", "barangays", "barangay_id"),
    ("announcements", "profiles", "created_by"),
    ("announcement_reads", "profiles", "resident_id"),
    ("announcement_reads", "announcements", "announcement_id"),
    ("incident_categories", "barangays", "barangay_id"),
    ("incidents", "barangays", "barangay_id"),
    ("incidents", "profiles", "reporter_id"),
    ("incidents", "incident_categories", "category_id"),
    ("incidents", "waste_zones", "zone_id"),
    ("incident_confirmations", "incidents", "incident_id"),
    ("incident_confirmations", "profiles", "user_id"),
    ("evacuation_centers", "barangays", "barangay_id"),
    ("evacuation_center_checkins", "evacuation_centers", "evacuation_center_id"),
    ("evacuation_center_checkins", "profiles", "user_id"),
    ("evacuation_center_checkins", "barangays", "barangay_id"),
    ("evacuation_center_qr_codes", "evacuation_centers", "evacuation_center_id"),
    ("medical_drives", "barangays", "barangay_id"),
    ("drive_registrations", "medical_drives", "drive_id"),
    ("drive_registrations", "auth_users", "user_id"),
    ("household_members", "profiles", "profile_id"),
    ("household_members", "evacuation_centers", "checked_in_center_id"),
    ("emergency_information", "barangays", "barangay_id"),
    ("emergency_information", "profiles", "created_by"),
    ("emergency_qr_content", "barangays", "barangay_id"),
    ("waste_zones", "barangays", "barangay_id"),
    ("waste_collection_schedules", "barangays", "barangay_id"),
    ("waste_collection_schedules", "waste_zones", "zone_id"),
    ("faq_articles", "barangays", "barangay_id"),
    ("barangay_officials", "profiles", "profile_id"),
    ("barangay_officials", "barangays", "barangay_id"),
    ("admin_audit_log", "barangays", "barangay_id"),
    ("admin_audit_log", "auth_users", "admin_id"),
    ("site_content", "barangays", "barangay_id"),
    ("about_us", "barangays", "barangay_id"),
    ("developer_profiles", "about_us", "about_us_id"),
    ("developer_profiles", "barangays", "barangay_id"),
    ("push_tokens", "auth_users", "user_id"),
]

lines = ["erDiagram"]

for a, b, label in EDGES:
    A = a.upper()
    B = b.upper()
    lines.append('    ' + B + ' ||--o{ ' + A + ' : "' + label + '"')

for name, cols in TABLES:
    N = name.upper()
    lines.append('    ' + N + ' {')
    for col_name, col_type, flag in cols:
        key = ""
        if flag == "PK":
            key = "PK"
        elif flag == "FK":
            key = "FK"
        elif flag == "PK_FK":
            key = "PK,FK"
        if key:
            lines.append('        ' + col_type + ' ' + col_name + ' ' + key)
        else:
            lines.append('        ' + col_type + ' ' + col_name)
    lines.append('    }')

mermaid = "\n".join(lines)
with open(r"C:\Users\User\barangayan\.scratch\barangayan_erd.mmd", "w", encoding="utf-8") as f:
    f.write(mermaid)

print("Lines:", len(lines))
print("Tables:", len(TABLES))

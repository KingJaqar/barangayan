// Generated from the isolated PostgreSQL 17 catalog for migration 20261021111056.
import type { Json } from './database';

export type HouseholdAttendanceTables = {
  household_attendance: {
    Row: {
      id: string;
      household_profile_id: string;
      household_member_id: string | null;
      barangay_id: string;
      evacuation_center_id: string;
      checked_in_at: string;
      checked_in_by: string;
      checked_out_at: string | null;
      checked_out_by: string | null;
    };
    Insert: {
      id?: string;
      household_profile_id: string;
      household_member_id?: string | null;
      barangay_id: string;
      evacuation_center_id: string;
      checked_in_at?: string;
      checked_in_by: string;
      checked_out_at?: string | null;
      checked_out_by?: string | null;
    };
    Update: {
      id?: string;
      household_profile_id?: string;
      household_member_id?: string | null;
      barangay_id?: string;
      evacuation_center_id?: string;
      checked_in_at?: string;
      checked_in_by?: string;
      checked_out_at?: string | null;
      checked_out_by?: string | null;
    };
    Relationships: [
      {
        foreignKeyName: "household_attendance_barangay_id_fkey";
        columns: ["barangay_id"];
        isOneToOne: false;
        referencedRelation: "barangays";
        referencedColumns: ["id"];
      },
      {
        foreignKeyName: "household_attendance_checked_in_by_fkey";
        columns: ["checked_in_by"];
        isOneToOne: false;
        referencedRelation: "profiles";
        referencedColumns: ["id"];
      },
      {
        foreignKeyName: "household_attendance_checked_out_by_fkey";
        columns: ["checked_out_by"];
        isOneToOne: false;
        referencedRelation: "profiles";
        referencedColumns: ["id"];
      },
      {
        foreignKeyName: "household_attendance_evacuation_center_id_fkey";
        columns: ["evacuation_center_id"];
        isOneToOne: false;
        referencedRelation: "evacuation_centers";
        referencedColumns: ["id"];
      },
      {
        foreignKeyName: "household_attendance_household_member_id_household_profile_fkey";
        columns: ["household_member_id", "household_profile_id"];
        isOneToOne: false;
        referencedRelation: "household_members";
        referencedColumns: ["id", "profile_id"];
      },
      {
        foreignKeyName: "household_attendance_household_profile_id_fkey";
        columns: ["household_profile_id"];
        isOneToOne: false;
        referencedRelation: "profiles";
        referencedColumns: ["id"];
      },
    ];
  };
};

export type HouseholdAttendanceViews = {
  household_attendance_receipt_exports: {
    Row: {
      id: string | null;
      household_profile_id: string | null;
      request_id: string | null;
      operation: string | null;
      created_at: string | null;
    };
    Relationships: [];
  };
};

export type HouseholdAttendanceFunctions = {
  check_in_household_members: {
    Args: {
      p_profile_id: string;
      p_center_id: string;
      p_participants: Json;
      p_request_id: string;
    };
    Returns: Json;
  };
  check_out_household_attendance: {
    Args: {
      p_attendance_ids: string[];
      p_request_id: string;
    };
    Returns: Json;
  };
  get_my_household_attendance: {
    Args: Record<string, never>;
    Returns: Json;
  };
  lookup_household_for_attendance: {
    Args: {
      p_qr_payload: string;
    };
    Returns: Json;
  };
};

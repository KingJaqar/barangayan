export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.15"
  }
  graphql_public: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      graphql: {
        Args: {
          extensions?: Json
          operationName?: string
          query?: string
          variables?: Json
        }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  public: {
    Tables: {
      evacuation_centers: {
        Row: {
          address: string | null
          barangay_id: string
          capacity: number | null
          contact_number: string | null
          created_at: string
          current_occupancy: number
          deleted_at: string | null
          facilities: string[]
          id: string
          is_active: boolean
          name: string
          position: Json            // { lat: number; lng: number }
          updated_at: string
        }
        Insert: {
          address?: string | null
          barangay_id: string
          capacity?: number | null
          contact_number?: string | null
          created_at?: string
          current_occupancy?: number
          deleted_at?: string | null
          facilities?: string[]
          id?: string
          is_active?: boolean
          name: string
          position: Json
          updated_at?: string
        }
        Update: {
          address?: string | null
          barangay_id?: string
          capacity?: number | null
          contact_number?: string | null
          created_at?: string
          current_occupancy?: number
          deleted_at?: string | null
          facilities?: string[]
          id?: string
          is_active?: boolean
          name?: string
          position?: Json
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "evacuation_centers_barangay_id_fkey"
            columns: ["barangay_id"]
            isOneToOne: false
            referencedRelation: "barangays"
            referencedColumns: ["id"]
          },
        ]
      }
      incident_confirmations: {
        Row: {
          incident_id: string
          user_id:     string
          created_at:  string
        }
        Insert: {
          incident_id: string
          user_id:     string
          created_at?: string
        }
        Update: {
          incident_id?: string
          user_id?:     string
          created_at?:  string
        }
        Relationships: [
          {
            foreignKeyName: "incident_confirmations_incident_id_fkey"
            columns: ["incident_id"]
            isOneToOne: false
            referencedRelation: "incidents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "incident_confirmations_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      incident_categories: {
        Row: {
          barangay_id: string
          color: string
          created_at: string
          icon: string | null
          id: string
          is_trash_related: boolean
          name: string
        }
        Insert: {
          barangay_id: string
          color?: string
          created_at?: string
          icon?: string | null
          id?: string
          is_trash_related?: boolean
          name: string
        }
        Update: {
          barangay_id?: string
          color?: string
          created_at?: string
          icon?: string | null
          id?: string
          is_trash_related?: boolean
          name?: string
        }
        Relationships: [
          {
            foreignKeyName: "incident_categories_barangay_id_fkey"
            columns: ["barangay_id"]
            isOneToOne: false
            referencedRelation: "barangays"
            referencedColumns: ["id"]
          },
        ]
      }
      incidents: {
        Row: {
          barangay_id: string
          category_id: string | null
          confirmation_count: number
          created_at: string
          deleted_at: string | null
          description: string | null
          id: string
          location: Json            // { lat: number; lng: number }
          photo_urls: string[]
          reporter_id: string | null
          status: string
          title: string
          updated_at: string
        }
        Insert: {
          barangay_id: string
          category_id?: string | null
          confirmation_count?: number
          created_at?: string
          deleted_at?: string | null
          description?: string | null
          id?: string
          location: Json
          photo_urls?: string[]
          reporter_id?: string | null
          status?: string
          title: string
          updated_at?: string
        }
        Update: {
          barangay_id?: string
          category_id?: string | null
          confirmation_count?: number
          created_at?: string
          deleted_at?: string | null
          description?: string | null
          id?: string
          location?: Json
          photo_urls?: string[]
          reporter_id?: string | null
          status?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "incidents_barangay_id_fkey"
            columns: ["barangay_id"]
            isOneToOne: false
            referencedRelation: "barangays"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "incidents_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "incident_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "incidents_reporter_id_fkey"
            columns: ["reporter_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      announcements: {
        Row: {
          barangay_id: string
          body: string
          category: string
          created_at: string
          created_by: string | null
          deleted_at: string | null
          id: string
          image_url: string | null
          published_at: string
          title: string
        }
        Insert: {
          barangay_id: string
          body: string
          category?: string
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          id?: string
          image_url?: string | null
          published_at?: string
          title: string
        }
        Update: {
          barangay_id?: string
          body?: string
          category?: string
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          id?: string
          image_url?: string | null
          published_at?: string
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "announcements_barangay_id_fkey"
            columns: ["barangay_id"]
            isOneToOne: false
            referencedRelation: "barangays"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "announcements_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      barangays: {
        Row: {
          boundary: Json | null
          config: Json
          created_at: string
          id: string
          name: string
        }
        Insert: {
          boundary?: Json | null
          config?: Json
          created_at?: string
          id?: string
          name: string
        }
        Update: {
          boundary?: Json | null
          config?: Json
          created_at?: string
          id?: string
          name?: string
        }
        Relationships: []
      }
      document_types: {
        Row: {
          barangay_id: string
          created_at: string
          deleted_at: string | null
          description: string | null
          fee_centavos: number
          id: string
          is_active: boolean
          name: string
          processing_target_hours: number
          requirements: string[]
        }
        Insert: {
          barangay_id: string
          created_at?: string
          deleted_at?: string | null
          description?: string | null
          fee_centavos?: number
          id?: string
          is_active?: boolean
          name: string
          processing_target_hours?: number
          requirements?: string[]
        }
        Update: {
          barangay_id?: string
          created_at?: string
          deleted_at?: string | null
          description?: string | null
          fee_centavos?: number
          id?: string
          is_active?: boolean
          name?: string
          processing_target_hours?: number
          requirements?: string[]
        }
        Relationships: [
          {
            foreignKeyName: "document_types_barangay_id_fkey"
            columns: ["barangay_id"]
            isOneToOne: false
            referencedRelation: "barangays"
            referencedColumns: ["id"]
          },
        ]
      }
      payments: {
        Row: {
          amount_centavos: number
          barangay_id: string
          collected_by: string | null
          created_at: string
          deleted_at: string | null
          id: string
          method: string
          paid_at: string | null
          paymongo_source_id: string | null
          service_request_id: string
          status: string
          updated_at: string
        }
        Insert: {
          amount_centavos: number
          barangay_id: string
          collected_by?: string | null
          created_at?: string
          deleted_at?: string | null
          id?: string
          method: string
          paid_at?: string | null
          paymongo_source_id?: string | null
          service_request_id: string
          status?: string
          updated_at?: string
        }
        Update: {
          amount_centavos?: number
          barangay_id?: string
          collected_by?: string | null
          created_at?: string
          deleted_at?: string | null
          id?: string
          method?: string
          paid_at?: string | null
          paymongo_source_id?: string | null
          service_request_id?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "payments_barangay_id_fkey"
            columns: ["barangay_id"]
            isOneToOne: false
            referencedRelation: "barangays"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_collected_by_fkey"
            columns: ["collected_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_service_request_id_fkey"
            columns: ["service_request_id"]
            isOneToOne: false
            referencedRelation: "admin_notifications"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_service_request_id_fkey"
            columns: ["service_request_id"]
            isOneToOne: false
            referencedRelation: "service_requests"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          accent_color: string
          barangay_id: string
          created_at: string
          deleted_at: string | null
          email_verification_requested_at: string | null
          email_verification_status: string
          email_verified_at: string | null
          full_name: string
          home_address: string | null
          id: string
          mobile_number: string | null
          role: string
          theme_preference: string
          updated_at: string
        }
        Insert: {
          accent_color?: string
          barangay_id: string
          created_at?: string
          deleted_at?: string | null
          email_verification_requested_at?: string | null
          email_verification_status?: string
          email_verified_at?: string | null
          full_name: string
          home_address?: string | null
          id: string
          mobile_number?: string | null
          role?: string
          theme_preference?: string
          updated_at?: string
        }
        Update: {
          accent_color?: string
          barangay_id?: string
          created_at?: string
          deleted_at?: string | null
          email_verification_requested_at?: string | null
          email_verification_status?: string
          email_verified_at?: string | null
          full_name?: string
          home_address?: string | null
          id?: string
          mobile_number?: string | null
          role?: string
          theme_preference?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "profiles_barangay_id_fkey"
            columns: ["barangay_id"]
            isOneToOne: false
            referencedRelation: "barangays"
            referencedColumns: ["id"]
          },
        ]
      }
      service_requests: {
        Row: {
          barangay_id: string
          created_at: string
          deleted_at: string | null
          document_type_id: string
          id: string
          id_document_path: string | null
          payment_method: string | null
          payment_status: string
          reference_number: string
          requester_notes: string | null
          resident_id: string
          status: string
          status_history: Json
          updated_at: string
        }
        Insert: {
          barangay_id: string
          created_at?: string
          deleted_at?: string | null
          document_type_id: string
          id?: string
          id_document_path?: string | null
          payment_method?: string | null
          payment_status?: string
          reference_number?: string
          requester_notes?: string | null
          resident_id: string
          status?: string
          status_history?: Json
          updated_at?: string
        }
        Update: {
          barangay_id?: string
          created_at?: string
          deleted_at?: string | null
          document_type_id?: string
          id?: string
          id_document_path?: string | null
          payment_method?: string | null
          payment_status?: string
          reference_number?: string
          requester_notes?: string | null
          resident_id?: string
          status?: string
          status_history?: Json
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "service_requests_barangay_id_fkey"
            columns: ["barangay_id"]
            isOneToOne: false
            referencedRelation: "barangays"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "service_requests_document_type_id_fkey"
            columns: ["document_type_id"]
            isOneToOne: false
            referencedRelation: "document_types"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "service_requests_resident_id_fkey"
            columns: ["resident_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      admin_notifications: {
        Row: {
          barangay_id: string | null
          created_at: string | null
          id: string | null
          reference_number: string | null
          status: string | null
        }
        Insert: {
          barangay_id?: string | null
          created_at?: string | null
          id?: string | null
          reference_number?: string | null
          status?: string | null
        }
        Update: {
          barangay_id?: string | null
          created_at?: string | null
          id?: string | null
          reference_number?: string | null
          status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "service_requests_barangay_id_fkey"
            columns: ["barangay_id"]
            isOneToOne: false
            referencedRelation: "barangays"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      begin_processing_request: {
        Args: { request_id: string }
        Returns: undefined
      }
      cancel_service_request: {
        Args: { p_note: string; p_request_id: string }
        Returns: undefined
      }
      complete_service_request: {
        Args: { p_request_id: string }
        Returns: undefined
      }
      current_barangay_id: { Args: never; Returns: string }
      current_role: { Args: never; Returns: string }
      mark_request_out_for_delivery: {
        Args: { p_request_id: string }
        Returns: undefined
      }
      set_service_request_payment_method: {
        Args: { p_method: string; p_request_id: string }
        Returns: undefined
      }
      confirm_incident: {
        Args: { p_incident_id: string }
        Returns: boolean
      }
      update_incident_status: {
        Args: { p_incident_id: string; p_status: string }
        Returns: undefined
      }
      soft_delete_incident: {
        Args: { p_incident_id: string }
        Returns: undefined
      }
      withdraw_incident: {
        Args: { p_incident_id: string }
        Returns: undefined
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {},
  },
} as const

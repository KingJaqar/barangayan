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
      about_us: {
        Row: {
          address: string | null
          barangay_id: string
          contact_email: string | null
          contact_phone: string | null
          created_at: string
          deleted_at: string | null
          history: string
          id: string
          is_active: boolean
          logo_url: string | null
          mission: string
          sort_order: number
          updated_at: string
          vision: string
        }
        Insert: {
          address?: string | null
          barangay_id: string
          contact_email?: string | null
          contact_phone?: string | null
          created_at?: string
          deleted_at?: string | null
          history?: string
          id?: string
          is_active?: boolean
          logo_url?: string | null
          mission?: string
          sort_order?: number
          updated_at?: string
          vision?: string
        }
        Update: {
          address?: string | null
          barangay_id?: string
          contact_email?: string | null
          contact_phone?: string | null
          created_at?: string
          deleted_at?: string | null
          history?: string
          id?: string
          is_active?: boolean
          logo_url?: string | null
          mission?: string
          sort_order?: number
          updated_at?: string
          vision?: string
        }
        Relationships: [
          {
            foreignKeyName: "about_us_barangay_id_fkey"
            columns: ["barangay_id"]
            isOneToOne: false
            referencedRelation: "barangays"
            referencedColumns: ["id"]
          },
        ]
      }
      admin_audit_log: {
        Row: {
          action: string
          admin_id: string | null
          barangay_id: string | null
          changes: Json | null
          created_at: string
          entity_id: string | null
          entity_label: string | null
          entity_type: string
          id: string
          is_read: boolean
          metadata: Json | null
        }
        Insert: {
          action: string
          admin_id?: string | null
          barangay_id?: string | null
          changes?: Json | null
          created_at?: string
          entity_id?: string | null
          entity_label?: string | null
          entity_type: string
          id?: string
          is_read?: boolean
          metadata?: Json | null
        }
        Update: {
          action?: string
          admin_id?: string | null
          barangay_id?: string | null
          changes?: Json | null
          created_at?: string
          entity_id?: string | null
          entity_label?: string | null
          entity_type?: string
          id?: string
          is_read?: boolean
          metadata?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "admin_audit_log_barangay_id_fkey"
            columns: ["barangay_id"]
            isOneToOne: false
            referencedRelation: "barangays"
            referencedColumns: ["id"]
          },
        ]
      }
      announcement_reads: {
        Row: {
          announcement_id: string
          read_at: string
          resident_id: string
        }
        Insert: {
          announcement_id: string
          read_at?: string
          resident_id: string
        }
        Update: {
          announcement_id?: string
          read_at?: string
          resident_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "announcement_reads_announcement_id_fkey"
            columns: ["announcement_id"]
            isOneToOne: false
            referencedRelation: "announcements"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "announcement_reads_resident_id_fkey"
            columns: ["resident_id"]
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
      barangay_officials: {
        Row: {
          barangay_id: string
          created_at: string
          date_hired: string
          deleted_at: string | null
          id: string
          is_active: boolean
          notes: string | null
          official_role: string
          profile_id: string
          updated_at: string
        }
        Insert: {
          barangay_id: string
          created_at?: string
          date_hired?: string
          deleted_at?: string | null
          id?: string
          is_active?: boolean
          notes?: string | null
          official_role?: string
          profile_id: string
          updated_at?: string
        }
        Update: {
          barangay_id?: string
          created_at?: string
          date_hired?: string
          deleted_at?: string | null
          id?: string
          is_active?: boolean
          notes?: string | null
          official_role?: string
          profile_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "barangay_officials_barangay_id_fkey"
            columns: ["barangay_id"]
            isOneToOne: false
            referencedRelation: "barangays"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "barangay_officials_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: true
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
          updated_at: string
        }
        Insert: {
          boundary?: Json | null
          config?: Json
          created_at?: string
          id?: string
          name: string
          updated_at?: string
        }
        Update: {
          boundary?: Json | null
          config?: Json
          created_at?: string
          id?: string
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      developer_profiles: {
        Row: {
          about_us_id: string
          barangay_id: string
          bio: string
          created_at: string
          deleted_at: string | null
          id: string
          name: string
          photo_url: string | null
          role: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          about_us_id: string
          barangay_id: string
          bio?: string
          created_at?: string
          deleted_at?: string | null
          id?: string
          name?: string
          photo_url?: string | null
          role?: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          about_us_id?: string
          barangay_id?: string
          bio?: string
          created_at?: string
          deleted_at?: string | null
          id?: string
          name?: string
          photo_url?: string | null
          role?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "developer_profiles_about_us_id_fkey"
            columns: ["about_us_id"]
            isOneToOne: false
            referencedRelation: "about_us"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "developer_profiles_barangay_id_fkey"
            columns: ["barangay_id"]
            isOneToOne: false
            referencedRelation: "barangays"
            referencedColumns: ["id"]
          },
        ]
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
      drive_registrations: {
        Row: {
          age: number
          applicant_number: string
          comorbidities: string[]
          created_at: string
          drive_id: string
          id: string
          is_pwd: boolean
          prior_dose_date: string | null
          priority_score: number
          status: Database["public"]["Enums"]["drive_registration_status"]
          updated_at: string
          user_id: string
        }
        Insert: {
          age: number
          applicant_number: string
          comorbidities?: string[]
          created_at?: string
          drive_id: string
          id?: string
          is_pwd?: boolean
          prior_dose_date?: string | null
          priority_score?: number
          status?: Database["public"]["Enums"]["drive_registration_status"]
          updated_at?: string
          user_id: string
        }
        Update: {
          age?: number
          applicant_number?: string
          comorbidities?: string[]
          created_at?: string
          drive_id?: string
          id?: string
          is_pwd?: boolean
          prior_dose_date?: string | null
          priority_score?: number
          status?: Database["public"]["Enums"]["drive_registration_status"]
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "drive_registrations_drive_id_fkey"
            columns: ["drive_id"]
            isOneToOne: false
            referencedRelation: "medical_drives"
            referencedColumns: ["id"]
          },
        ]
      }
      emergency_information: {
        Row: {
          barangay_id: string
          body: string
          category: string
          content: Json
          created_at: string
          created_by: string | null
          deleted_at: string | null
          icon: string
          icon_bg: string
          icon_color: string
          id: string
          is_active: boolean
          published_at: string
          sort_order: number
          title: string
        }
        Insert: {
          barangay_id: string
          body?: string
          category: string
          content?: Json
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          icon?: string
          icon_bg?: string
          icon_color?: string
          id?: string
          is_active?: boolean
          published_at?: string
          sort_order?: number
          title: string
        }
        Update: {
          barangay_id?: string
          body?: string
          category?: string
          content?: Json
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          icon?: string
          icon_bg?: string
          icon_color?: string
          id?: string
          is_active?: boolean
          published_at?: string
          sort_order?: number
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "emergency_information_barangay_id_fkey"
            columns: ["barangay_id"]
            isOneToOne: false
            referencedRelation: "barangays"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "emergency_information_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      emergency_qr_content: {
        Row: {
          barangay_id: string
          body: string
          content: Json
          created_at: string
          deleted_at: string | null
          icon: string | null
          icon_bg: string | null
          icon_color: string | null
          id: string
          is_active: boolean
          section: string
          sort_order: number
          title: string
          updated_at: string
        }
        Insert: {
          barangay_id: string
          body?: string
          content?: Json
          created_at?: string
          deleted_at?: string | null
          icon?: string | null
          icon_bg?: string | null
          icon_color?: string | null
          id?: string
          is_active?: boolean
          section: string
          sort_order?: number
          title: string
          updated_at?: string
        }
        Update: {
          barangay_id?: string
          body?: string
          content?: Json
          created_at?: string
          deleted_at?: string | null
          icon?: string | null
          icon_bg?: string | null
          icon_color?: string | null
          id?: string
          is_active?: boolean
          section?: string
          sort_order?: number
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "emergency_qr_content_barangay_id_fkey"
            columns: ["barangay_id"]
            isOneToOne: false
            referencedRelation: "barangays"
            referencedColumns: ["id"]
          },
        ]
      }
      evacuation_center_checkins: {
        Row: {
          barangay_id: string
          checked_in_at: string
          created_at: string
          evacuation_center_id: string
          id: string
          user_id: string
        }
        Insert: {
          barangay_id: string
          checked_in_at?: string
          created_at?: string
          evacuation_center_id: string
          id?: string
          user_id: string
        }
        Update: {
          barangay_id?: string
          checked_in_at?: string
          created_at?: string
          evacuation_center_id?: string
          id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "evacuation_center_checkins_barangay_id_fkey"
            columns: ["barangay_id"]
            isOneToOne: false
            referencedRelation: "barangays"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "evacuation_center_checkins_evacuation_center_id_fkey"
            columns: ["evacuation_center_id"]
            isOneToOne: false
            referencedRelation: "evacuation_centers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "evacuation_center_checkins_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      evacuation_center_qr_codes: {
        Row: {
          created_at: string
          evacuation_center_id: string
          id: string
          is_active: boolean
          qr_image_url: string | null
          qr_payload: Json
          updated_at: string
        }
        Insert: {
          created_at?: string
          evacuation_center_id: string
          id?: string
          is_active?: boolean
          qr_image_url?: string | null
          qr_payload: Json
          updated_at?: string
        }
        Update: {
          created_at?: string
          evacuation_center_id?: string
          id?: string
          is_active?: boolean
          qr_image_url?: string | null
          qr_payload?: Json
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "evacuation_center_qr_codes_evacuation_center_id_fkey"
            columns: ["evacuation_center_id"]
            isOneToOne: true
            referencedRelation: "evacuation_centers"
            referencedColumns: ["id"]
          },
        ]
      }
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
          position: Json
          updated_at: string
          verified: boolean
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
          verified?: boolean
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
          verified?: boolean
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
      faq_articles: {
        Row: {
          answer: string
          barangay_id: string
          category: string
          created_at: string
          deleted_at: string | null
          id: string
          is_active: boolean
          question: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          answer?: string
          barangay_id: string
          category?: string
          created_at?: string
          deleted_at?: string | null
          id?: string
          is_active?: boolean
          question: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          answer?: string
          barangay_id?: string
          category?: string
          created_at?: string
          deleted_at?: string | null
          id?: string
          is_active?: boolean
          question?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "faq_articles_barangay_id_fkey"
            columns: ["barangay_id"]
            isOneToOne: false
            referencedRelation: "barangays"
            referencedColumns: ["id"]
          },
        ]
      }
      household_members: {
        Row: {
          avatar_url: string | null
          checked_in_at: string | null
          checked_in_center_id: string | null
          checked_in_center_name: string | null
          created_at: string
          id: string
          is_checked_in: boolean
          name: string
          profile_id: string
          relation: string
          role: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          checked_in_at?: string | null
          checked_in_center_id?: string | null
          checked_in_center_name?: string | null
          created_at?: string
          id?: string
          is_checked_in?: boolean
          name: string
          profile_id: string
          relation: string
          role?: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          checked_in_at?: string | null
          checked_in_center_id?: string | null
          checked_in_center_name?: string | null
          created_at?: string
          id?: string
          is_checked_in?: boolean
          name?: string
          profile_id?: string
          relation?: string
          role?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "household_members_checked_in_center_id_fkey"
            columns: ["checked_in_center_id"]
            isOneToOne: false
            referencedRelation: "evacuation_centers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "household_members_profile_id_fkey"
            columns: ["profile_id"]
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
      incident_confirmations: {
        Row: {
          created_at: string
          incident_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          incident_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          incident_id?: string
          user_id?: string
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
      incidents: {
        Row: {
          barangay_id: string
          category_id: string | null
          confirmation_count: number
          created_at: string
          deleted_at: string | null
          description: string | null
          id: string
          location: Json
          photo_urls: string[]
          reporter_id: string | null
          resolved_read_at: string | null
          status: string
          title: string
          updated_at: string
          zone_id: string | null
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
          resolved_read_at?: string | null
          status?: string
          title: string
          updated_at?: string
          zone_id?: string | null
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
          resolved_read_at?: string | null
          status?: string
          title?: string
          updated_at?: string
          zone_id?: string | null
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
          {
            foreignKeyName: "incidents_zone_id_fkey"
            columns: ["zone_id"]
            isOneToOne: false
            referencedRelation: "waste_zones"
            referencedColumns: ["id"]
          },
        ]
      }
      medical_drives: {
        Row: {
          barangay_id: string
          created_at: string
          deleted_at: string | null
          drive_date: string
          eligible_criteria: string
          id: string
          is_active: boolean
          location: string
          stock_label: string
          stock_remaining: number
          stock_total: number
          stock_unit: string
          time_end: string
          time_start: string
          title: string
          type: Database["public"]["Enums"]["drive_type"]
          updated_at: string
        }
        Insert: {
          barangay_id: string
          created_at?: string
          deleted_at?: string | null
          drive_date: string
          eligible_criteria: string
          id?: string
          is_active?: boolean
          location?: string
          stock_label?: string
          stock_remaining: number
          stock_total: number
          stock_unit?: string
          time_end: string
          time_start: string
          title: string
          type: Database["public"]["Enums"]["drive_type"]
          updated_at?: string
        }
        Update: {
          barangay_id?: string
          created_at?: string
          deleted_at?: string | null
          drive_date?: string
          eligible_criteria?: string
          id?: string
          is_active?: boolean
          location?: string
          stock_label?: string
          stock_remaining?: number
          stock_total?: number
          stock_unit?: string
          time_end?: string
          time_start?: string
          title?: string
          type?: Database["public"]["Enums"]["drive_type"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "medical_drives_barangay_id_fkey"
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
          document_fee_centavos: number | null
          expires_at: string | null
          id: string
          method: string
          paid_at: string | null
          paymongo_payment_id: string | null
          paymongo_payment_intent_id: string | null
          paymongo_source_id: string | null
          qr_image_url: string | null
          refund_amount_centavos: number | null
          refund_reason: string | null
          refund_status: string
          refund_transfer_link: string | null
          refunded_at: string | null
          refunded_by: string | null
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
          document_fee_centavos?: number | null
          expires_at?: string | null
          id?: string
          method: string
          paid_at?: string | null
          paymongo_payment_id?: string | null
          paymongo_payment_intent_id?: string | null
          paymongo_source_id?: string | null
          qr_image_url?: string | null
          refund_amount_centavos?: number | null
          refund_reason?: string | null
          refund_status?: string
          refund_transfer_link?: string | null
          refunded_at?: string | null
          refunded_by?: string | null
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
          document_fee_centavos?: number | null
          expires_at?: string | null
          id?: string
          method?: string
          paid_at?: string | null
          paymongo_payment_id?: string | null
          paymongo_payment_intent_id?: string | null
          paymongo_source_id?: string | null
          qr_image_url?: string | null
          refund_amount_centavos?: number | null
          refund_reason?: string | null
          refund_status?: string
          refund_transfer_link?: string | null
          refunded_at?: string | null
          refunded_by?: string | null
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
            foreignKeyName: "payments_refunded_by_fkey"
            columns: ["refunded_by"]
            isOneToOne: false
            referencedRelation: "profiles"
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
          avatar_url: string | null
          barangay_id: string
          birth_date: string | null
          city: string | null
          created_at: string
          custom_accent_colors: string[]
          deleted_at: string | null
          email: string | null
          email_verification_requested_at: string | null
          email_verification_status: string
          email_verified_at: string | null
          employment_status: string | null
          first_name: string | null
          font_preference: string
          full_name: string
          home_address: string | null
          house_no: string | null
          household_members: Json
          id: string
          id_photo_urls: string[]
          id_type: string | null
          id_verification_status: string | null
          last_name: string | null
          location_verified: boolean | null
          middle_name: string | null
          mobile_number: string | null
          occupation: string | null
          push_notifications_enabled: boolean
          registration_location: Json | null
          role: string
          sex: string | null
          street: string | null
          suffix: string | null
          theme_preference: string
          updated_at: string
        }
        Insert: {
          accent_color?: string
          avatar_url?: string | null
          barangay_id: string
          birth_date?: string | null
          city?: string | null
          created_at?: string
          custom_accent_colors?: string[]
          deleted_at?: string | null
          email?: string | null
          email_verification_requested_at?: string | null
          email_verification_status?: string
          email_verified_at?: string | null
          employment_status?: string | null
          first_name?: string | null
          font_preference?: string
          full_name: string
          home_address?: string | null
          house_no?: string | null
          household_members?: Json
          id: string
          id_photo_urls?: string[]
          id_type?: string | null
          id_verification_status?: string | null
          last_name?: string | null
          location_verified?: boolean | null
          middle_name?: string | null
          mobile_number?: string | null
          occupation?: string | null
          push_notifications_enabled?: boolean
          registration_location?: Json | null
          role?: string
          sex?: string | null
          street?: string | null
          suffix?: string | null
          theme_preference?: string
          updated_at?: string
        }
        Update: {
          accent_color?: string
          avatar_url?: string | null
          barangay_id?: string
          birth_date?: string | null
          city?: string | null
          created_at?: string
          custom_accent_colors?: string[]
          deleted_at?: string | null
          email?: string | null
          email_verification_requested_at?: string | null
          email_verification_status?: string
          email_verified_at?: string | null
          employment_status?: string | null
          first_name?: string | null
          font_preference?: string
          full_name?: string
          home_address?: string | null
          house_no?: string | null
          household_members?: Json
          id?: string
          id_photo_urls?: string[]
          id_type?: string | null
          id_verification_status?: string | null
          last_name?: string | null
          location_verified?: boolean | null
          middle_name?: string | null
          mobile_number?: string | null
          occupation?: string | null
          push_notifications_enabled?: boolean
          registration_location?: Json | null
          role?: string
          sex?: string | null
          street?: string | null
          suffix?: string | null
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
      push_tokens: {
        Row: {
          created_at: string
          device_type: string
          expo_push_token: string
          id: string
          last_used_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          device_type: string
          expo_push_token: string
          id?: string
          last_used_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          device_type?: string
          expo_push_token?: string
          id?: string
          last_used_at?: string
          user_id?: string
        }
        Relationships: []
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
      site_content: {
        Row: {
          barangay_id: string
          body: string
          created_at: string
          deleted_at: string | null
          id: string
          is_active: boolean
          section: string
          sort_order: number
          title: string
          updated_at: string
        }
        Insert: {
          barangay_id: string
          body?: string
          created_at?: string
          deleted_at?: string | null
          id?: string
          is_active?: boolean
          section: string
          sort_order?: number
          title?: string
          updated_at?: string
        }
        Update: {
          barangay_id?: string
          body?: string
          created_at?: string
          deleted_at?: string | null
          id?: string
          is_active?: boolean
          section?: string
          sort_order?: number
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "site_content_barangay_id_fkey"
            columns: ["barangay_id"]
            isOneToOne: false
            referencedRelation: "barangays"
            referencedColumns: ["id"]
          },
        ]
      }
      waste_collection_schedules: {
        Row: {
          barangay_id: string
          created_at: string
          day_of_week: number
          deleted_at: string | null
          end_time: string
          id: string
          is_active: boolean
          notes: string
          sort_order: number
          start_time: string
          updated_at: string
          waste_type: string
          zone_id: string
        }
        Insert: {
          barangay_id: string
          created_at?: string
          day_of_week: number
          deleted_at?: string | null
          end_time: string
          id?: string
          is_active?: boolean
          notes?: string
          sort_order?: number
          start_time: string
          updated_at?: string
          waste_type: string
          zone_id: string
        }
        Update: {
          barangay_id?: string
          created_at?: string
          day_of_week?: number
          deleted_at?: string | null
          end_time?: string
          id?: string
          is_active?: boolean
          notes?: string
          sort_order?: number
          start_time?: string
          updated_at?: string
          waste_type?: string
          zone_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "waste_collection_schedules_barangay_id_fkey"
            columns: ["barangay_id"]
            isOneToOne: false
            referencedRelation: "barangays"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "waste_collection_schedules_zone_id_fkey"
            columns: ["zone_id"]
            isOneToOne: false
            referencedRelation: "waste_zones"
            referencedColumns: ["id"]
          },
        ]
      }
      waste_zones: {
        Row: {
          barangay_id: string
          created_at: string
          deleted_at: string | null
          description: string
          id: string
          is_active: boolean
          name: string
          sort_order: number
          trash_score: number
          trash_score_updated_at: string | null
          updated_at: string
        }
        Insert: {
          barangay_id: string
          created_at?: string
          deleted_at?: string | null
          description?: string
          id?: string
          is_active?: boolean
          name: string
          sort_order?: number
          trash_score?: number
          trash_score_updated_at?: string | null
          updated_at?: string
        }
        Update: {
          barangay_id?: string
          created_at?: string
          deleted_at?: string | null
          description?: string
          id?: string
          is_active?: boolean
          name?: string
          sort_order?: number
          trash_score?: number
          trash_score_updated_at?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "waste_zones_barangay_id_fkey"
            columns: ["barangay_id"]
            isOneToOne: false
            referencedRelation: "barangays"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      admin_add_household_member: {
        Args: {
          p_name: string
          p_profile_id: string
          p_relation: string
          p_role?: string
        }
        Returns: string
      }
      admin_remove_household_member: {
        Args: { p_member_id: string; p_profile_id: string }
        Returns: undefined
      }
      admin_update_household_member: {
        Args: {
          p_member_id: string
          p_name: string
          p_profile_id: string
          p_relation: string
          p_role: string
        }
        Returns: undefined
      }
      begin_processing_request: {
        Args: { request_id: string }
        Returns: undefined
      }
      cancel_own_service_request: {
        Args: { p_note: string | null; p_request_id: string }
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
      admin_register_for_drive: {
        Args: {
          p_age: number
          p_comorbidities: string[]
          p_drive_id: string
          p_is_pwd: boolean
          p_prior_dose_date?: string
          p_target_user_id: string
        }
        Returns: Json
      }
      confirm_incident: { Args: { p_incident_id: string }; Returns: boolean }
      current_barangay_id: { Args: never; Returns: string }
      current_role: { Args: never; Returns: string }
      mark_request_ready_for_pickup: {
        Args: { p_request_id: string }
        Returns: undefined
      }
      recompute_waste_zone_scores: {
        Args: never
        Returns: undefined
      }
      register_for_drive: {
        Args: {
          p_age: number
          p_comorbidities: string[]
          p_drive_id: string
          p_is_pwd: boolean
          p_prior_dose_date?: string
        }
        Returns: Json
      }
      save_about_us_with_developers: {
        Args: {
          p_address: string
          p_barangay_id: string
          p_contact_email: string
          p_contact_phone: string
          p_developers: Json
          p_history: string
          p_is_active?: boolean
          p_logo_url: string
          p_mission: string
          p_sort_order?: number
          p_vision: string
        }
        Returns: string
      }
      set_service_request_payment_method: {
        Args: { p_method: string; p_request_id: string }
        Returns: undefined
      }
      soft_delete_incident: {
        Args: { p_incident_id: string }
        Returns: undefined
      }
      update_incident_status: {
        Args: { p_incident_id: string; p_status: string }
        Returns: undefined
      }
      upsert_push_token: {
        Args: { p_device_type: string; p_expo_push_token: string }
        Returns: undefined
      }
      withdraw_incident: { Args: { p_incident_id: string }; Returns: undefined }
    }
    Enums: {
      drive_registration_status:
        | "pending"
        | "confirmed"
        | "attended"
        | "cancelled"
      drive_type:
        | "vaccination"
        | "maternal_care"
        | "blood_drive"
        | "medicine"
        | "dental"
        | "optical"
        | "emergency_kit"
        | "screening"
        | "consultation"
        | "minor_surgical"
        | "others"
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
    Enums: {
      drive_registration_status: [
        "pending",
        "confirmed",
        "attended",
        "cancelled",
      ],
      drive_type: [
        "vaccination",
        "maternal_care",
        "blood_drive",
        "medicine",
        "dental",
        "optical",
        "emergency_kit",
        "screening",
        "consultation",
        "minor_surgical",
        "others",
      ],
    },
  },
} as const

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
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      family_forms: {
        Row: {
          created_at: string
          id: number
          registry_district: string
          registry_number: string | null
          registry_town: string
          sect: string | null
          summer_country: string | null
          summer_district: string | null
          summer_governorate: string | null
          summer_phone: string | null
          summer_street: string | null
          summer_town: string | null
          updated_at: string
          winter_country: string | null
          winter_district: string | null
          winter_governorate: string | null
          winter_phone: string | null
          winter_street: string | null
          winter_town: string | null
        }
        Insert: {
          created_at?: string
          id?: number
          registry_district: string
          registry_number?: string | null
          registry_town: string
          sect?: string | null
          summer_country?: string | null
          summer_district?: string | null
          summer_governorate?: string | null
          summer_phone?: string | null
          summer_street?: string | null
          summer_town?: string | null
          updated_at?: string
          winter_country?: string | null
          winter_district?: string | null
          winter_governorate?: string | null
          winter_phone?: string | null
          winter_street?: string | null
          winter_town?: string | null
        }
        Update: {
          created_at?: string
          id?: number
          registry_district?: string
          registry_number?: string | null
          registry_town?: string
          sect?: string | null
          summer_country?: string | null
          summer_district?: string | null
          summer_governorate?: string | null
          summer_phone?: string | null
          summer_street?: string | null
          summer_town?: string | null
          updated_at?: string
          winter_country?: string | null
          winter_district?: string | null
          winter_governorate?: string | null
          winter_phone?: string | null
          winter_street?: string | null
          winter_town?: string | null
        }
        Relationships: []
      }
      individuals: {
        Row: {
          birth_year: number | null
          created_at: string
          current_residence: string | null
          family_form_id: number
          father_name: string | null
          first_name: string
          has_voted: boolean | null
          id: number
          is_military: boolean | null
          last_name: string
          lives_with_family: boolean | null
          marital_status: string | null
          mobile: string | null
          mother_name: string | null
          political_leaning: string | null
          preferred_candidate: string | null
          relation: string
          updated_at: string
          voter_status: string | null
        }
        Insert: {
          birth_year?: number | null
          created_at?: string
          current_residence?: string | null
          family_form_id: number
          father_name?: string | null
          first_name: string
          has_voted?: boolean | null
          id?: number
          is_military?: boolean | null
          last_name: string
          lives_with_family?: boolean | null
          marital_status?: string | null
          mobile?: string | null
          mother_name?: string | null
          political_leaning?: string | null
          preferred_candidate?: string | null
          relation: string
          updated_at?: string
          voter_status?: string | null
        }
        Update: {
          birth_year?: number | null
          created_at?: string
          current_residence?: string | null
          family_form_id?: number
          father_name?: string | null
          first_name?: string
          has_voted?: boolean | null
          id?: number
          is_military?: boolean | null
          last_name?: string
          lives_with_family?: boolean | null
          marital_status?: string | null
          mobile?: string | null
          mother_name?: string | null
          political_leaning?: string | null
          preferred_candidate?: string | null
          relation?: string
          updated_at?: string
          voter_status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "individuals_family_form_id_fkey"
            columns: ["family_form_id"]
            isOneToOne: false
            referencedRelation: "family_forms"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
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
  public: {
    Enums: {},
  },
} as const

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
    PostgrestVersion: "13.0.5"
  }
  public: {
    Tables: {
      clients: {
        Row: {
          client_name: string
          client_name_norm: string
          created_at: string | null
          id: string
          notes: string | null
          updated_at: string | null
        }
        Insert: {
          client_name: string
          client_name_norm: string
          created_at?: string | null
          id?: string
          notes?: string | null
          updated_at?: string | null
        }
        Update: {
          client_name?: string
          client_name_norm?: string
          created_at?: string | null
          id?: string
          notes?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      daybook_entries: {
        Row: {
          advance_amount: number | null
          challan_number: string
          client_id: string
          created_at: string | null
          entry_date: string
          id: string
          notes: string | null
          total_amount: number | null
          updated_at: string | null
        }
        Insert: {
          advance_amount?: number | null
          challan_number: string
          client_id: string
          created_at?: string | null
          entry_date?: string
          id?: string
          notes?: string | null
          total_amount?: number | null
          updated_at?: string | null
        }
        Update: {
          advance_amount?: number | null
          challan_number?: string
          client_id?: string
          created_at?: string | null
          entry_date?: string
          id?: string
          notes?: string | null
          total_amount?: number | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "daybook_entries_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      glass_stock_items: {
        Row: {
          breadth: number
          comment: string | null
          created_at: string
          glass_variant_id: string
          id: string
          length: number
          number_of_sheets: number
          unit: string
          updated_at: string
        }
        Insert: {
          breadth: number
          comment?: string | null
          created_at?: string
          glass_variant_id: string
          id?: string
          length: number
          number_of_sheets?: number
          unit?: string
          updated_at?: string
        }
        Update: {
          breadth?: number
          comment?: string | null
          created_at?: string
          glass_variant_id?: string
          id?: string
          length?: number
          number_of_sheets?: number
          unit?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "glass_stock_items_glass_variant_id_fkey"
            columns: ["glass_variant_id"]
            isOneToOne: false
            referencedRelation: "glass_variants"
            referencedColumns: ["id"]
          },
        ]
      }
      glass_types: {
        Row: {
          created_at: string
          glass_type_name: string
          id: string
          notes: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          glass_type_name: string
          id?: string
          notes?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          glass_type_name?: string
          id?: string
          notes?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      glass_variants: {
        Row: {
          company_purchased: string
          created_at: string
          glass_type_id: string
          id: string
          notes: string | null
          thickness: string
          updated_at: string
        }
        Insert: {
          company_purchased: string
          created_at?: string
          glass_type_id: string
          id?: string
          notes?: string | null
          thickness: string
          updated_at?: string
        }
        Update: {
          company_purchased?: string
          created_at?: string
          glass_type_id?: string
          id?: string
          notes?: string | null
          thickness?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "glass_variants_glass_type_id_fkey"
            columns: ["glass_type_id"]
            isOneToOne: false
            referencedRelation: "glass_types"
            referencedColumns: ["id"]
          },
        ]
      }
      inventory_activity_log: {
        Row: {
          action_type: string
          changed_at: string
          changed_by: string | null
          comment: string | null
          glass_stock_item_id: string | null
          glass_type_id: string | null
          glass_variant_id: string | null
          id: string
          new_value: Json | null
          old_value: Json | null
        }
        Insert: {
          action_type: string
          changed_at?: string
          changed_by?: string | null
          comment?: string | null
          glass_stock_item_id?: string | null
          glass_type_id?: string | null
          glass_variant_id?: string | null
          id?: string
          new_value?: Json | null
          old_value?: Json | null
        }
        Update: {
          action_type?: string
          changed_at?: string
          changed_by?: string | null
          comment?: string | null
          glass_stock_item_id?: string | null
          glass_type_id?: string | null
          glass_variant_id?: string | null
          id?: string
          new_value?: Json | null
          old_value?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "inventory_activity_log_glass_stock_item_id_fkey"
            columns: ["glass_stock_item_id"]
            isOneToOne: false
            referencedRelation: "glass_stock_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_activity_log_glass_type_id_fkey"
            columns: ["glass_type_id"]
            isOneToOne: false
            referencedRelation: "glass_types"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_activity_log_glass_variant_id_fkey"
            columns: ["glass_variant_id"]
            isOneToOne: false
            referencedRelation: "glass_variants"
            referencedColumns: ["id"]
          },
        ]
      }
      orders: {
        Row: {
          address: string | null
          advance_amount: number | null
          assign_site: Database["public"]["Enums"]["site_enum"] | null
          city: string | null
          created_at: string | null
          customer_name: string
          estimated_duration: number | null
          files: Json | null
          freight_amount: number | null
          id: string
          notes: string | null
          order_date: string
          order_number: number
          phone: string | null
          processing_site: Database["public"]["Enums"]["site_enum"] | null
          stage: Database["public"]["Enums"]["order_stage_enum"]
          timeline: Json | null
          total_amount: number | null
          updated_at: string | null
        }
        Insert: {
          address?: string | null
          advance_amount?: number | null
          assign_site?: Database["public"]["Enums"]["site_enum"] | null
          city?: string | null
          created_at?: string | null
          customer_name: string
          estimated_duration?: number | null
          files?: Json | null
          freight_amount?: number | null
          id?: string
          notes?: string | null
          order_date?: string
          order_number?: number
          phone?: string | null
          processing_site?: Database["public"]["Enums"]["site_enum"] | null
          stage?: Database["public"]["Enums"]["order_stage_enum"]
          timeline?: Json | null
          total_amount?: number | null
          updated_at?: string | null
        }
        Update: {
          address?: string | null
          advance_amount?: number | null
          assign_site?: Database["public"]["Enums"]["site_enum"] | null
          city?: string | null
          created_at?: string | null
          customer_name?: string
          estimated_duration?: number | null
          files?: Json | null
          freight_amount?: number | null
          id?: string
          notes?: string | null
          order_date?: string
          order_number?: number
          phone?: string | null
          processing_site?: Database["public"]["Enums"]["site_enum"] | null
          stage?: Database["public"]["Enums"]["order_stage_enum"]
          timeline?: Json | null
          total_amount?: number | null
          updated_at?: string | null
        }
        Relationships: []
      }
      other_entries: {
        Row: {
          amount: number
          created_at: string | null
          entry_date: string
          id: string
          notes: string | null
          service: string
          updated_at: string | null
        }
        Insert: {
          amount: number
          created_at?: string | null
          entry_date?: string
          id?: string
          notes?: string | null
          service: string
          updated_at?: string | null
        }
        Update: {
          amount?: number
          created_at?: string | null
          entry_date?: string
          id?: string
          notes?: string | null
          service?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string | null
          display_name: string | null
          email: string
          role: Database["public"]["Enums"]["role_enum"]
          updated_at: string | null
          user_id: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string | null
          display_name?: string | null
          email: string
          role?: Database["public"]["Enums"]["role_enum"]
          updated_at?: string | null
          user_id: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string | null
          display_name?: string | null
          email?: string
          role?: Database["public"]["Enums"]["role_enum"]
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      rama_entries: {
        Row: {
          advance_amount: number | null
          challan_number: string
          client_id: string
          created_at: string | null
          entry_date: string
          id: string
          notes: string | null
          total_amount: number | null
          updated_at: string | null
        }
        Insert: {
          advance_amount?: number | null
          challan_number: string
          client_id: string
          created_at?: string | null
          entry_date?: string
          id?: string
          notes?: string | null
          total_amount?: number | null
          updated_at?: string | null
        }
        Update: {
          advance_amount?: number | null
          challan_number?: string
          client_id?: string
          created_at?: string | null
          entry_date?: string
          id?: string
          notes?: string | null
          total_amount?: number | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "rama_entries_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      staff_members: {
        Row: {
          active: boolean | null
          created_at: string | null
          id: string
          monthly_salary: number
          notes: string | null
          staff_name: string
          staff_type: string | null
          updated_at: string | null
        }
        Insert: {
          active?: boolean | null
          created_at?: string | null
          id?: string
          monthly_salary: number
          notes?: string | null
          staff_name: string
          staff_type?: string | null
          updated_at?: string | null
        }
        Update: {
          active?: boolean | null
          created_at?: string | null
          id?: string
          monthly_salary?: number
          notes?: string | null
          staff_name?: string
          staff_type?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      staff_transactions: {
        Row: {
          created_at: string | null
          entry_date: string
          id: string
          money_taken: number
          notes: string | null
          staff_id: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          entry_date?: string
          id?: string
          money_taken?: number
          notes?: string | null
          staff_id: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          entry_date?: string
          id?: string
          money_taken?: number
          notes?: string | null
          staff_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "staff_transactions_staff_id_fkey"
            columns: ["staff_id"]
            isOneToOne: false
            referencedRelation: "staff_members"
            referencedColumns: ["id"]
          },
        ]
      }
      toughened_diary_entries: {
        Row: {
          advance_amount: number | null
          challan_number: string
          client_id: string
          created_at: string | null
          entry_date: string
          id: string
          notes: string | null
          total_amount: number | null
          updated_at: string | null
        }
        Insert: {
          advance_amount?: number | null
          challan_number: string
          client_id: string
          created_at?: string | null
          entry_date?: string
          id?: string
          notes?: string | null
          total_amount?: number | null
          updated_at?: string | null
        }
        Update: {
          advance_amount?: number | null
          challan_number?: string
          client_id?: string
          created_at?: string | null
          entry_date?: string
          id?: string
          notes?: string | null
          total_amount?: number | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "toughened_diary_entries_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      vehicle_transactions: {
        Row: {
          amount: number
          created_at: string | null
          entry_date: string
          id: string
          notes: string | null
          reason: string
          updated_at: string | null
          vehicle_id: string
        }
        Insert: {
          amount: number
          created_at?: string | null
          entry_date?: string
          id?: string
          notes?: string | null
          reason: string
          updated_at?: string | null
          vehicle_id: string
        }
        Update: {
          amount?: number
          created_at?: string | null
          entry_date?: string
          id?: string
          notes?: string | null
          reason?: string
          updated_at?: string | null
          vehicle_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "vehicle_transactions_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicles"
            referencedColumns: ["id"]
          },
        ]
      }
      vehicles: {
        Row: {
          active: boolean | null
          created_at: string | null
          id: string
          notes: string | null
          updated_at: string | null
          vehicle_number: string
          vehicle_type: string
        }
        Insert: {
          active?: boolean | null
          created_at?: string | null
          id?: string
          notes?: string | null
          updated_at?: string | null
          vehicle_number: string
          vehicle_type: string
        }
        Update: {
          active?: boolean | null
          created_at?: string | null
          id?: string
          notes?: string | null
          updated_at?: string | null
          vehicle_number?: string
          vehicle_type?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["role_enum"]
          _user_id: string
        }
        Returns: boolean
      }
      is_admin: { Args: { _user_id: string }; Returns: boolean }
    }
    Enums: {
      order_stage_enum:
        | "intake"
        | "assign_site"
        | "processing"
        | "dispatch"
        | "fitting"
        | "closed"
      role_enum: "admin" | "manager" | "staff"
      site_enum: "naka" | "godown"
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
    Enums: {
      order_stage_enum: [
        "intake",
        "assign_site",
        "processing",
        "dispatch",
        "fitting",
        "closed",
      ],
      role_enum: ["admin", "manager", "staff"],
      site_enum: ["naka", "godown"],
    },
  },
} as const

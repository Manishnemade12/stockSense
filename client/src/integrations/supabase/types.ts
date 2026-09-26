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
      locations: {
        Row: {
          code: string
          created_at: string
          id: number
          is_active: boolean
          location_type: Database["public"]["Enums"]["location_type"]
          name: string
          parent_location_id: number | null
          warehouse_id: number | null
        }
        Insert: {
          code: string
          created_at?: string
          id?: number
          is_active?: boolean
          location_type?: Database["public"]["Enums"]["location_type"]
          name: string
          parent_location_id?: number | null
          warehouse_id?: number | null
        }
        Update: {
          code?: string
          created_at?: string
          id?: number
          is_active?: boolean
          location_type?: Database["public"]["Enums"]["location_type"]
          name?: string
          parent_location_id?: number | null
          warehouse_id?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "locations_parent_location_id_fkey"
            columns: ["parent_location_id"]
            isOneToOne: false
            referencedRelation: "locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "locations_warehouse_id_fkey"
            columns: ["warehouse_id"]
            isOneToOne: false
            referencedRelation: "warehouses"
            referencedColumns: ["id"]
          },
        ]
      }
      operation_sequences: {
        Row: {
          last_value: number
          op_code: string
          warehouse_id: number
        }
        Insert: {
          last_value?: number
          op_code: string
          warehouse_id: number
        }
        Update: {
          last_value?: number
          op_code?: string
          warehouse_id?: number
        }
        Relationships: [
          {
            foreignKeyName: "operation_sequences_warehouse_id_fkey"
            columns: ["warehouse_id"]
            isOneToOne: false
            referencedRelation: "warehouses"
            referencedColumns: ["id"]
          },
        ]
      }
      partners: {
        Row: {
          address: string | null
          email: string | null
          id: number
          is_active: boolean
          name: string
          phone: string | null
          type: Database["public"]["Enums"]["partner_type"]
        }
        Insert: {
          address?: string | null
          email?: string | null
          id?: number
          is_active?: boolean
          name: string
          phone?: string | null
          type: Database["public"]["Enums"]["partner_type"]
        }
        Update: {
          address?: string | null
          email?: string | null
          id?: number
          is_active?: boolean
          name?: string
          phone?: string | null
          type?: Database["public"]["Enums"]["partner_type"]
        }
        Relationships: []
      }
      product_categories: {
        Row: {
          id: number
          is_active: boolean
          name: string
          parent_category_id: number | null
        }
        Insert: {
          id?: number
          is_active?: boolean
          name: string
          parent_category_id?: number | null
        }
        Update: {
          id?: number
          is_active?: boolean
          name?: string
          parent_category_id?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "product_categories_parent_category_id_fkey"
            columns: ["parent_category_id"]
            isOneToOne: false
            referencedRelation: "product_categories"
            referencedColumns: ["id"]
          },
        ]
      }
      products: {
        Row: {
          barcode: string | null
          category_id: number
          created_at: string
          description: string | null
          id: number
          is_active: boolean
          name: string
          reorder_max_qty: number | null
          reorder_min_qty: number
          sku: string
          unit_cost: number
          uom_id: number
          updated_at: string
        }
        Insert: {
          barcode?: string | null
          category_id: number
          created_at?: string
          description?: string | null
          id?: number
          is_active?: boolean
          name: string
          reorder_max_qty?: number | null
          reorder_min_qty?: number
          sku: string
          unit_cost?: number
          uom_id: number
          updated_at?: string
        }
        Update: {
          barcode?: string | null
          category_id?: number
          created_at?: string
          description?: string | null
          id?: number
          is_active?: boolean
          name?: string
          reorder_max_qty?: number | null
          reorder_min_qty?: number
          sku?: string
          unit_cost?: number
          uom_id?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "products_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "product_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "products_uom_id_fkey"
            columns: ["uom_id"]
            isOneToOne: false
            referencedRelation: "units_of_measure"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          email: string
          full_name: string | null
          id: string
          is_active: boolean
          login_id: string
          phone: string | null
          updated_at: string
          warehouse_id: number | null
        }
        Insert: {
          created_at?: string
          email: string
          full_name?: string | null
          id: string
          is_active?: boolean
          login_id: string
          phone?: string | null
          updated_at?: string
          warehouse_id?: number | null
        }
        Update: {
          created_at?: string
          email?: string
          full_name?: string | null
          id?: string
          is_active?: boolean
          login_id?: string
          phone?: string | null
          updated_at?: string
          warehouse_id?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "profiles_warehouse_id_fkey"
            columns: ["warehouse_id"]
            isOneToOne: false
            referencedRelation: "warehouses"
            referencedColumns: ["id"]
          },
        ]
      }
      stock_adjustment_lines: {
        Row: {
          counted_quantity: number
          difference: number
          id: number
          location_id: number
          operation_id: number
          product_id: number
          recorded_quantity: number
          uom_id: number
        }
        Insert: {
          counted_quantity?: number
          difference?: number
          id?: number
          location_id: number
          operation_id: number
          product_id: number
          recorded_quantity?: number
          uom_id: number
        }
        Update: {
          counted_quantity?: number
          difference?: number
          id?: number
          location_id?: number
          operation_id?: number
          product_id?: number
          recorded_quantity?: number
          uom_id?: number
        }
        Relationships: [
          {
            foreignKeyName: "stock_adjustment_lines_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_adjustment_lines_operation_id_fkey"
            columns: ["operation_id"]
            isOneToOne: false
            referencedRelation: "stock_operations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_adjustment_lines_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_adjustment_lines_uom_id_fkey"
            columns: ["uom_id"]
            isOneToOne: false
            referencedRelation: "units_of_measure"
            referencedColumns: ["id"]
          },
        ]
      }
      stock_ledger_entries: {
        Row: {
          balance_after: number
          created_by: string | null
          id: number
          location_id: number
          movement_date: string
          operation_id: number
          operation_type: Database["public"]["Enums"]["operation_type"]
          product_id: number
          quantity_change: number
          reference_no: string
        }
        Insert: {
          balance_after: number
          created_by?: string | null
          id?: number
          location_id: number
          movement_date?: string
          operation_id: number
          operation_type: Database["public"]["Enums"]["operation_type"]
          product_id: number
          quantity_change: number
          reference_no: string
        }
        Update: {
          balance_after?: number
          created_by?: string | null
          id?: number
          location_id?: number
          movement_date?: string
          operation_id?: number
          operation_type?: Database["public"]["Enums"]["operation_type"]
          product_id?: number
          quantity_change?: number
          reference_no?: string
        }
        Relationships: [
          {
            foreignKeyName: "stock_ledger_entries_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_ledger_entries_operation_id_fkey"
            columns: ["operation_id"]
            isOneToOne: false
            referencedRelation: "stock_operations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_ledger_entries_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      stock_operation_lines: {
        Row: {
          id: number
          notes: string | null
          operation_id: number
          product_id: number
          quantity_done: number
          quantity_planned: number
          uom_id: number
        }
        Insert: {
          id?: number
          notes?: string | null
          operation_id: number
          product_id: number
          quantity_done?: number
          quantity_planned?: number
          uom_id: number
        }
        Update: {
          id?: number
          notes?: string | null
          operation_id?: number
          product_id?: number
          quantity_done?: number
          quantity_planned?: number
          uom_id?: number
        }
        Relationships: [
          {
            foreignKeyName: "stock_operation_lines_operation_id_fkey"
            columns: ["operation_id"]
            isOneToOne: false
            referencedRelation: "stock_operations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_operation_lines_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_operation_lines_uom_id_fkey"
            columns: ["uom_id"]
            isOneToOne: false
            referencedRelation: "units_of_measure"
            referencedColumns: ["id"]
          },
        ]
      }
      stock_operations: {
        Row: {
          created_at: string
          created_by: string
          destination_location_id: number | null
          id: number
          notes: string | null
          operation_type: Database["public"]["Enums"]["operation_type"]
          partner_id: number | null
          reference_no: string
          responsible_user_id: string | null
          scheduled_date: string
          source_location_id: number | null
          status: Database["public"]["Enums"]["operation_status"]
          updated_at: string
          validated_date: string | null
          warehouse_id: number
        }
        Insert: {
          created_at?: string
          created_by: string
          destination_location_id?: number | null
          id?: number
          notes?: string | null
          operation_type: Database["public"]["Enums"]["operation_type"]
          partner_id?: number | null
          reference_no: string
          responsible_user_id?: string | null
          scheduled_date?: string
          source_location_id?: number | null
          status?: Database["public"]["Enums"]["operation_status"]
          updated_at?: string
          validated_date?: string | null
          warehouse_id: number
        }
        Update: {
          created_at?: string
          created_by?: string
          destination_location_id?: number | null
          id?: number
          notes?: string | null
          operation_type?: Database["public"]["Enums"]["operation_type"]
          partner_id?: number | null
          reference_no?: string
          responsible_user_id?: string | null
          scheduled_date?: string
          source_location_id?: number | null
          status?: Database["public"]["Enums"]["operation_status"]
          updated_at?: string
          validated_date?: string | null
          warehouse_id?: number
        }
        Relationships: [
          {
            foreignKeyName: "stock_operations_destination_location_id_fkey"
            columns: ["destination_location_id"]
            isOneToOne: false
            referencedRelation: "locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_operations_partner_id_fkey"
            columns: ["partner_id"]
            isOneToOne: false
            referencedRelation: "partners"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_operations_source_location_id_fkey"
            columns: ["source_location_id"]
            isOneToOne: false
            referencedRelation: "locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_operations_warehouse_id_fkey"
            columns: ["warehouse_id"]
            isOneToOne: false
            referencedRelation: "warehouses"
            referencedColumns: ["id"]
          },
        ]
      }
      stock_quants: {
        Row: {
          id: number
          location_id: number
          product_id: number
          quantity: number
          reserved_quantity: number
          updated_at: string
        }
        Insert: {
          id?: number
          location_id: number
          product_id: number
          quantity?: number
          reserved_quantity?: number
          updated_at?: string
        }
        Update: {
          id?: number
          location_id?: number
          product_id?: number
          quantity?: number
          reserved_quantity?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "stock_quants_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_quants_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      units_of_measure: {
        Row: {
          code: string
          id: number
          is_active: boolean
          name: string
        }
        Insert: {
          code: string
          id?: number
          is_active?: boolean
          name: string
        }
        Update: {
          code?: string
          id?: number
          is_active?: boolean
          name?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      warehouses: {
        Row: {
          address: string | null
          code: string
          created_at: string
          id: number
          is_active: boolean
          name: string
        }
        Insert: {
          address?: string | null
          code: string
          created_at?: string
          id?: number
          is_active?: boolean
          name: string
        }
        Update: {
          address?: string | null
          code?: string
          created_at?: string
          id?: number
          is_active?: boolean
          name?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      _apply_move: {
        Args: {
          _delta: number
          _loc: number
          _op: Database["public"]["Tables"]["stock_operations"]["Row"]
          _product: number
        }
        Returns: undefined
      }
      _op_has_stock: {
        Args: { _op_id: number; _own_reserved: boolean }
        Returns: boolean
      }
      _reserve: {
        Args: { _delta: number; _loc: number; _product: number }
        Returns: undefined
      }
      admin_update_user: {
        Args: {
          _is_active: boolean
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
          _warehouse_id: number
        }
        Returns: undefined
      }
      cancel_operation: { Args: { _id: number }; Returns: undefined }
      check_signup_available: {
        Args: { _email: string; _login_id: string }
        Returns: string
      }
      confirm_operation: {
        Args: { _id: number }
        Returns: Database["public"]["Enums"]["operation_status"]
      }
      create_operation: { Args: { _payload: Json }; Returns: number }
      email_for_login: { Args: { _login_id: string }; Returns: string }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_manager: { Args: never; Returns: boolean }
      next_reference: {
        Args: { _t: Database["public"]["Enums"]["operation_type"]; _wh: number }
        Returns: string
      }
      op_code: {
        Args: { _t: Database["public"]["Enums"]["operation_type"] }
        Returns: string
      }
      qty_at: { Args: { _loc: number; _product: number }; Returns: number }
      refresh_waiting: { Args: never; Returns: undefined }
      set_stock: {
        Args: { _counted: number; _location: number; _product: number }
        Returns: number
      }
      update_operation: {
        Args: { _id: number; _payload: Json }
        Returns: undefined
      }
      validate_operation: { Args: { _id: number }; Returns: undefined }
      virtual_location: {
        Args: { _t: Database["public"]["Enums"]["location_type"] }
        Returns: number
      }
    }
    Enums: {
      app_role: "INVENTORY_MANAGER" | "WAREHOUSE_STAFF"
      location_type: "INTERNAL" | "VENDOR" | "CUSTOMER" | "ADJUSTMENT_VIRTUAL"
      operation_status: "DRAFT" | "WAITING" | "READY" | "DONE" | "CANCELED"
      operation_type:
        | "RECEIPT"
        | "DELIVERY"
        | "INTERNAL_TRANSFER"
        | "ADJUSTMENT"
      partner_type: "SUPPLIER" | "CUSTOMER"
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
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
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
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
      app_role: ["INVENTORY_MANAGER", "WAREHOUSE_STAFF"],
      location_type: ["INTERNAL", "VENDOR", "CUSTOMER", "ADJUSTMENT_VIRTUAL"],
      operation_status: ["DRAFT", "WAITING", "READY", "DONE", "CANCELED"],
      operation_type: [
        "RECEIPT",
        "DELIVERY",
        "INTERNAL_TRANSFER",
        "ADJUSTMENT",
      ],
      partner_type: ["SUPPLIER", "CUSTOMER"],
    },
  },
} as const

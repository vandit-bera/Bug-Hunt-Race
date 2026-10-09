export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type Database = {
  graphql_public: {
    Tables: {
      [_ in never]: never;
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      graphql: {
        Args: {
          extensions?: Json;
          operationName?: string;
          query?: string;
          variables?: Json;
        };
        Returns: Json;
      };
    };
    Enums: {
      [_ in never]: never;
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
  public: {
    Tables: {
      players: {
        Row: {
          avatar: string;
          connected: boolean;
          display_name: string;
          id: string;
          is_admin: boolean;
          joined_at: string;
          left_at: string | null;
          room_id: string;
          user_id: string;
        };
        ComputedFields: never;
        Insert: {
          avatar: string;
          connected?: boolean;
          display_name: string;
          id?: string;
          is_admin?: boolean;
          joined_at?: string;
          left_at?: string | null;
          room_id: string;
          user_id: string;
        };
        Update: {
          avatar?: string;
          connected?: boolean;
          display_name?: string;
          id?: string;
          is_admin?: boolean;
          joined_at?: string;
          left_at?: string | null;
          room_id?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "players_room_id_fkey";
            columns: ["room_id"];
            isOneToOne: false;
            referencedRelation: "rooms";
            referencedColumns: ["id"];
          },
        ];
      };
      puzzles: {
        Row: {
          active: boolean;
          base_points: number;
          buggy_code: string;
          created_at: string;
          description: string | null;
          hint: string | null;
          id: string;
          language: Database["public"]["Enums"]["language_id"];
          level: Database["public"]["Enums"]["puzzle_level"];
          tests: string;
          time_limit_seconds: number;
          title: string;
        };
        ComputedFields: never;
        Insert: {
          active?: boolean;
          base_points: number;
          buggy_code: string;
          created_at?: string;
          description?: string | null;
          hint?: string | null;
          id: string;
          language: Database["public"]["Enums"]["language_id"];
          level: Database["public"]["Enums"]["puzzle_level"];
          tests: string;
          time_limit_seconds: number;
          title: string;
        };
        Update: {
          active?: boolean;
          base_points?: number;
          buggy_code?: string;
          created_at?: string;
          description?: string | null;
          hint?: string | null;
          id?: string;
          language?: Database["public"]["Enums"]["language_id"];
          level?: Database["public"]["Enums"]["puzzle_level"];
          tests?: string;
          time_limit_seconds?: number;
          title?: string;
        };
        Relationships: [];
      };
      rooms: {
        Row: {
          admin_player_id: string | null;
          closed_at: string | null;
          code: string;
          created_at: string;
          current_round: number;
          game_number: number;
          id: string;
          language: Database["public"]["Enums"]["language_id"];
          level: Database["public"]["Enums"]["room_level"];
          locked: boolean;
          status: Database["public"]["Enums"]["room_status"];
          total_rounds: number | null;
          updated_at: string;
        };
        ComputedFields: never;
        Insert: {
          admin_player_id?: string | null;
          closed_at?: string | null;
          code: string;
          created_at?: string;
          current_round?: number;
          game_number?: number;
          id?: string;
          language: Database["public"]["Enums"]["language_id"];
          level: Database["public"]["Enums"]["room_level"];
          locked?: boolean;
          status?: Database["public"]["Enums"]["room_status"];
          total_rounds?: number | null;
          updated_at?: string;
        };
        Update: {
          admin_player_id?: string | null;
          closed_at?: string | null;
          code?: string;
          created_at?: string;
          current_round?: number;
          game_number?: number;
          id?: string;
          language?: Database["public"]["Enums"]["language_id"];
          level?: Database["public"]["Enums"]["room_level"];
          locked?: boolean;
          status?: Database["public"]["Enums"]["room_status"];
          total_rounds?: number | null;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "rooms_admin_player_fkey";
            columns: ["admin_player_id", "id"];
            isOneToOne: false;
            referencedRelation: "players";
            referencedColumns: ["id", "room_id"];
          },
          {
            foreignKeyName: "rooms_admin_player_fkey";
            columns: ["admin_player_id", "id"];
            isOneToOne: false;
            referencedRelation: "room_leaderboard";
            referencedColumns: ["player_id", "room_id"];
          },
        ];
      };
      rounds: {
        Row: {
          ended_at: string | null;
          game_number: number;
          id: string;
          paused_at: string | null;
          paused_ms: number;
          puzzle_id: string;
          room_id: string;
          round_number: number;
          started_at: string;
        };
        ComputedFields: never;
        Insert: {
          ended_at?: string | null;
          game_number?: number;
          id?: string;
          paused_at?: string | null;
          paused_ms?: number;
          puzzle_id: string;
          room_id: string;
          round_number: number;
          started_at?: string;
        };
        Update: {
          ended_at?: string | null;
          game_number?: number;
          id?: string;
          paused_at?: string | null;
          paused_ms?: number;
          puzzle_id?: string;
          room_id?: string;
          round_number?: number;
          started_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "rounds_puzzle_id_fkey";
            columns: ["puzzle_id"];
            isOneToOne: false;
            referencedRelation: "puzzles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "rounds_room_id_fkey";
            columns: ["room_id"];
            isOneToOne: false;
            referencedRelation: "rooms";
            referencedColumns: ["id"];
          },
        ];
      };
      scores: {
        Row: {
          hint_used: boolean;
          id: string;
          passed: boolean;
          player_id: string;
          points: number;
          round_id: string;
          solve_time_ms: number | null;
          submitted_at: string;
        };
        ComputedFields: never;
        Insert: {
          hint_used?: boolean;
          id?: string;
          passed?: boolean;
          player_id: string;
          points?: number;
          round_id: string;
          solve_time_ms?: number | null;
          submitted_at?: string;
        };
        Update: {
          hint_used?: boolean;
          id?: string;
          passed?: boolean;
          player_id?: string;
          points?: number;
          round_id?: string;
          solve_time_ms?: number | null;
          submitted_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "scores_player_id_fkey";
            columns: ["player_id"];
            isOneToOne: false;
            referencedRelation: "players";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "scores_player_id_fkey";
            columns: ["player_id"];
            isOneToOne: false;
            referencedRelation: "room_leaderboard";
            referencedColumns: ["player_id"];
          },
          {
            foreignKeyName: "scores_round_id_fkey";
            columns: ["round_id"];
            isOneToOne: false;
            referencedRelation: "rounds";
            referencedColumns: ["id"];
          },
        ];
      };
    };
    Views: {
      room_leaderboard: {
        Row: {
          avatar: string | null;
          connected: boolean | null;
          display_name: string | null;
          game_number: number | null;
          is_admin: boolean | null;
          last_solved_at: string | null;
          player_id: string | null;
          previous_rank: number | null;
          rank: number | null;
          room_id: string | null;
          rounds_solved: number | null;
          total_points: number | null;
          total_solve_ms: number | null;
        };
        ComputedFields: never;
        Relationships: [
          {
            foreignKeyName: "players_room_id_fkey";
            columns: ["room_id"];
            isOneToOne: false;
            referencedRelation: "rooms";
            referencedColumns: ["id"];
          },
        ];
      };
    };
    Functions: {
      advance_room: {
        Args: {
          room_event: Database["public"]["Enums"]["room_event"];
          target_room_id: string;
        };
        Returns: {
          admin_player_id: string | null;
          closed_at: string | null;
          code: string;
          created_at: string;
          current_round: number;
          game_number: number;
          id: string;
          language: Database["public"]["Enums"]["language_id"];
          level: Database["public"]["Enums"]["room_level"];
          locked: boolean;
          status: Database["public"]["Enums"]["room_status"];
          total_rounds: number | null;
          updated_at: string;
        };
        SetofOptions: {
          from: "*";
          to: "rooms";
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
      create_room: {
        Args: {
          avatar: string;
          display_name: string;
          room_language: Database["public"]["Enums"]["language_id"];
          room_level: Database["public"]["Enums"]["room_level"];
          room_total_rounds?: number;
        };
        Returns: {
          avatar: string;
          connected: boolean;
          display_name: string;
          id: string;
          is_admin: boolean;
          joined_at: string;
          left_at: string | null;
          room_id: string;
          user_id: string;
        };
        SetofOptions: {
          from: "*";
          to: "players";
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
      find_open_room: {
        Args: { room_code: string };
        Returns: {
          code: string;
          is_full: boolean;
          language: Database["public"]["Enums"]["language_id"];
          level: Database["public"]["Enums"]["room_level"];
          locked: boolean;
          player_count: number;
          status: Database["public"]["Enums"]["room_status"];
        }[];
      };
      get_current_round: {
        Args: { target_room_id: string };
        Returns: {
          base_points: number;
          buggy_code: string;
          description: string;
          ended_at: string;
          game_number: number;
          hint: string;
          joined_late: boolean;
          language: Database["public"]["Enums"]["language_id"];
          level: Database["public"]["Enums"]["puzzle_level"];
          paused_at: string;
          paused_ms: number;
          puzzle_id: string;
          round_id: string;
          round_number: number;
          server_now: string;
          started_at: string;
          submitted: boolean;
          tests: string;
          time_limit_seconds: number;
          title: string;
        }[];
      };
      join_room: {
        Args: { avatar: string; display_name: string; room_code: string };
        Returns: {
          avatar: string;
          connected: boolean;
          display_name: string;
          id: string;
          is_admin: boolean;
          joined_at: string;
          left_at: string | null;
          room_id: string;
          user_id: string;
        };
        SetofOptions: {
          from: "*";
          to: "players";
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
      leave_room: { Args: { target_room_id: string }; Returns: undefined };
      record_score: {
        Args: { hint_used: boolean; passed: boolean; round_id: string };
        Returns: {
          hint_used: boolean;
          id: string;
          passed: boolean;
          player_id: string;
          points: number;
          round_id: string;
          solve_time_ms: number | null;
          submitted_at: string;
        };
        SetofOptions: {
          from: "*";
          to: "scores";
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
      reveal_round_puzzle: {
        Args: { target_round_id: string };
        Returns: string;
      };
      room_heartbeat: {
        Args: { target_room_id: string };
        Returns: Database["public"]["Enums"]["room_status"];
      };
      set_room_locked: {
        Args: { room_locked: boolean; target_room_id: string };
        Returns: {
          admin_player_id: string | null;
          closed_at: string | null;
          code: string;
          created_at: string;
          current_round: number;
          game_number: number;
          id: string;
          language: Database["public"]["Enums"]["language_id"];
          level: Database["public"]["Enums"]["room_level"];
          locked: boolean;
          status: Database["public"]["Enums"]["room_status"];
          total_rounds: number | null;
          updated_at: string;
        };
        SetofOptions: {
          from: "*";
          to: "rooms";
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
    };
    Enums: {
      language_id: "javascript" | "typescript" | "python";
      puzzle_level: "easy" | "medium" | "hard";
      room_event:
        | "start"
        | "begin_round"
        | "pause"
        | "resume"
        | "end_round"
        | "next_round"
        | "finish"
        | "stop"
        | "play_again"
        | "close"
        | "abandon";
      room_level: "easy" | "medium" | "hard" | "mixed";
      room_status:
        | "lobby"
        | "countdown"
        | "round_live"
        | "paused"
        | "round_results"
        | "final_leaderboard"
        | "closed";
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">;

type DefaultSchema = DatabaseWithoutInternals[Extract<
  keyof Database,
  "public"
>];

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R;
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R;
      }
      ? R
      : never
    : never;

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema["Tables"] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I;
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I;
      }
      ? I
      : never
    : never;

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema["Tables"] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U;
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U;
      }
      ? U
      : never
    : never;

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    keyof DefaultSchema["Enums"] | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never;

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never;

export const Constants = {
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {
      language_id: ["javascript", "typescript", "python"],
      puzzle_level: ["easy", "medium", "hard"],
      room_event: [
        "start",
        "begin_round",
        "pause",
        "resume",
        "end_round",
        "next_round",
        "finish",
        "stop",
        "play_again",
        "close",
        "abandon",
      ],
      room_level: ["easy", "medium", "hard", "mixed"],
      room_status: [
        "lobby",
        "countdown",
        "round_live",
        "paused",
        "round_results",
        "final_leaderboard",
        "closed",
      ],
    },
  },
} as const;

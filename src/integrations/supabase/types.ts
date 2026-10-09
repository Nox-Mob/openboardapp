export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.18";
  };
  public: {
    Tables: {
      action_items: {
        Row: {
          assignee_id: string | null;
          created_at: string;
          created_by: string | null;
          details: string | null;
          due_date: string | null;
          id: string;
          meeting_id: string | null;
          organization_id: string;
          status: Database["public"]["Enums"]["task_status"];
          title: string;
        };
        Insert: {
          assignee_id?: string | null;
          created_at?: string;
          created_by?: string | null;
          details?: string | null;
          due_date?: string | null;
          id?: string;
          meeting_id?: string | null;
          organization_id: string;
          status?: Database["public"]["Enums"]["task_status"];
          title: string;
        };
        Update: {
          assignee_id?: string | null;
          created_at?: string;
          created_by?: string | null;
          details?: string | null;
          due_date?: string | null;
          id?: string;
          meeting_id?: string | null;
          organization_id?: string;
          status?: Database["public"]["Enums"]["task_status"];
          title?: string;
        };
        Relationships: [
          {
            foreignKeyName: "action_items_meeting_id_fkey";
            columns: ["meeting_id"];
            isOneToOne: false;
            referencedRelation: "meetings";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "action_items_organization_id_fkey";
            columns: ["organization_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
        ];
      };
      agenda_items: {
        Row: {
          created_at: string;
          decision_rule: string | null;
          description: string | null;
          duration_minutes: number | null;
          id: string;
          is_vote_item: boolean;
          meeting_id: string;
          notes: string;
          organization_id: string;
          position: number;
          presenter: string | null;
          proposed_motion: string | null;
          title: string;
        };
        Insert: {
          created_at?: string;
          decision_rule?: string | null;
          description?: string | null;
          duration_minutes?: number | null;
          id?: string;
          is_vote_item?: boolean;
          meeting_id: string;
          notes?: string;
          organization_id: string;
          position?: number;
          presenter?: string | null;
          proposed_motion?: string | null;
          title: string;
        };
        Update: {
          created_at?: string;
          decision_rule?: string | null;
          description?: string | null;
          duration_minutes?: number | null;
          id?: string;
          is_vote_item?: boolean;
          meeting_id?: string;
          notes?: string;
          organization_id?: string;
          position?: number;
          presenter?: string | null;
          proposed_motion?: string | null;
          title?: string;
        };
        Relationships: [
          {
            foreignKeyName: "agenda_items_meeting_id_fkey";
            columns: ["meeting_id"];
            isOneToOne: false;
            referencedRelation: "meetings";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "agenda_items_organization_id_fkey";
            columns: ["organization_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
        ];
      };
      attendance: {
        Row: {
          created_at: string;
          id: string;
          is_voting: boolean;
          meeting_id: string;
          organization_id: string;
          person_name: string;
          status: Database["public"]["Enums"]["attendance_status"];
          user_id: string | null;
        };
        Insert: {
          created_at?: string;
          id?: string;
          is_voting?: boolean;
          meeting_id: string;
          organization_id: string;
          person_name: string;
          status?: Database["public"]["Enums"]["attendance_status"];
          user_id?: string | null;
        };
        Update: {
          created_at?: string;
          id?: string;
          is_voting?: boolean;
          meeting_id?: string;
          organization_id?: string;
          person_name?: string;
          status?: Database["public"]["Enums"]["attendance_status"];
          user_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "attendance_meeting_id_fkey";
            columns: ["meeting_id"];
            isOneToOne: false;
            referencedRelation: "meetings";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "attendance_organization_id_fkey";
            columns: ["organization_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
        ];
      };
      audit_log: {
        Row: {
          action: string;
          actor_id: string | null;
          created_at: string;
          details: Json | null;
          entity: string;
          entity_id: string | null;
          id: number;
          organization_id: string;
          summary: string | null;
        };
        Insert: {
          action: string;
          actor_id?: string | null;
          created_at?: string;
          details?: Json | null;
          entity: string;
          entity_id?: string | null;
          id?: never;
          organization_id: string;
          summary?: string | null;
        };
        Update: {
          action?: string;
          actor_id?: string | null;
          created_at?: string;
          details?: Json | null;
          entity?: string;
          entity_id?: string | null;
          id?: never;
          organization_id?: string;
          summary?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "audit_log_organization_id_fkey";
            columns: ["organization_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
        ];
      };
      board_positions: {
        Row: {
          created_at: string;
          id: string;
          organization_id: string;
          sort_order: number;
          term_years: number | null;
          title: string;
        };
        Insert: {
          created_at?: string;
          id?: string;
          organization_id: string;
          sort_order?: number;
          term_years?: number | null;
          title: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          organization_id?: string;
          sort_order?: number;
          term_years?: number | null;
          title?: string;
        };
        Relationships: [
          {
            foreignKeyName: "board_positions_organization_id_fkey";
            columns: ["organization_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
        ];
      };
      board_terms: {
        Row: {
          created_at: string;
          end_date: string | null;
          id: string;
          notes: string | null;
          organization_id: string;
          person_name: string;
          position: string;
          position_id: string | null;
          start_date: string;
          user_id: string | null;
        };
        Insert: {
          created_at?: string;
          end_date?: string | null;
          id?: string;
          notes?: string | null;
          organization_id: string;
          person_name: string;
          position?: string;
          position_id?: string | null;
          start_date: string;
          user_id?: string | null;
        };
        Update: {
          created_at?: string;
          end_date?: string | null;
          id?: string;
          notes?: string | null;
          organization_id?: string;
          person_name?: string;
          position?: string;
          position_id?: string | null;
          start_date?: string;
          user_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "board_terms_organization_id_fkey";
            columns: ["organization_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "board_terms_position_id_fkey";
            columns: ["position_id"];
            isOneToOne: false;
            referencedRelation: "board_positions";
            referencedColumns: ["id"];
          },
        ];
      };
      committee_members: {
        Row: {
          committee_id: string;
          created_at: string;
          id: string;
          organization_id: string;
          person_name: string;
          role: string;
          user_id: string | null;
        };
        Insert: {
          committee_id: string;
          created_at?: string;
          id?: string;
          organization_id: string;
          person_name: string;
          role?: string;
          user_id?: string | null;
        };
        Update: {
          committee_id?: string;
          created_at?: string;
          id?: string;
          organization_id?: string;
          person_name?: string;
          role?: string;
          user_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "committee_members_committee_id_fkey";
            columns: ["committee_id"];
            isOneToOne: false;
            referencedRelation: "committees";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "committee_members_organization_id_fkey";
            columns: ["organization_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
        ];
      };
      committees: {
        Row: {
          created_at: string;
          description: string | null;
          id: string;
          name: string;
          organization_id: string;
        };
        Insert: {
          created_at?: string;
          description?: string | null;
          id?: string;
          name: string;
          organization_id: string;
        };
        Update: {
          created_at?: string;
          description?: string | null;
          id?: string;
          name?: string;
          organization_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "committees_organization_id_fkey";
            columns: ["organization_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
        ];
      };
      document_versions: {
        Row: {
          created_at: string;
          document_id: string;
          file_name: string;
          id: string;
          mime_type: string | null;
          organization_id: string;
          size_bytes: number | null;
          storage_path: string;
          uploaded_by: string | null;
          version: number;
        };
        Insert: {
          created_at?: string;
          document_id: string;
          file_name: string;
          id?: string;
          mime_type?: string | null;
          organization_id: string;
          size_bytes?: number | null;
          storage_path: string;
          uploaded_by?: string | null;
          version: number;
        };
        Update: {
          created_at?: string;
          document_id?: string;
          file_name?: string;
          id?: string;
          mime_type?: string | null;
          organization_id?: string;
          size_bytes?: number | null;
          storage_path?: string;
          uploaded_by?: string | null;
          version?: number;
        };
        Relationships: [
          {
            foreignKeyName: "document_versions_document_id_fkey";
            columns: ["document_id"];
            isOneToOne: false;
            referencedRelation: "documents";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "document_versions_organization_id_fkey";
            columns: ["organization_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
        ];
      };
      documents: {
        Row: {
          category: string;
          created_at: string;
          created_by: string | null;
          id: string;
          meeting_id: string | null;
          organization_id: string;
          title: string;
        };
        Insert: {
          category?: string;
          created_at?: string;
          created_by?: string | null;
          id?: string;
          meeting_id?: string | null;
          organization_id: string;
          title: string;
        };
        Update: {
          category?: string;
          created_at?: string;
          created_by?: string | null;
          id?: string;
          meeting_id?: string | null;
          organization_id?: string;
          title?: string;
        };
        Relationships: [
          {
            foreignKeyName: "documents_meeting_id_fkey";
            columns: ["meeting_id"];
            isOneToOne: false;
            referencedRelation: "meetings";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "documents_organization_id_fkey";
            columns: ["organization_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
        ];
      };
      invitations: {
        Row: {
          accepted_at: string | null;
          accepted_by: string | null;
          created_at: string;
          created_by: string;
          email: string | null;
          expires_at: string;
          id: string;
          organization_id: string;
          role: Database["public"]["Enums"]["org_role"];
          token_hash: string;
        };
        Insert: {
          accepted_at?: string | null;
          accepted_by?: string | null;
          created_at?: string;
          created_by: string;
          email?: string | null;
          expires_at?: string;
          id?: string;
          organization_id: string;
          role?: Database["public"]["Enums"]["org_role"];
          token_hash: string;
        };
        Update: {
          accepted_at?: string | null;
          accepted_by?: string | null;
          created_at?: string;
          created_by?: string;
          email?: string | null;
          expires_at?: string;
          id?: string;
          organization_id?: string;
          role?: Database["public"]["Enums"]["org_role"];
          token_hash?: string;
        };
        Relationships: [
          {
            foreignKeyName: "invitations_organization_id_fkey";
            columns: ["organization_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
        ];
      };
      meeting_templates: {
        Row: {
          agenda: Json;
          created_at: string;
          created_by: string | null;
          id: string;
          location: string | null;
          meeting_title: string;
          name: string;
          organization_id: string;
          start_time: string | null;
        };
        Insert: {
          agenda?: Json;
          created_at?: string;
          created_by?: string | null;
          id?: string;
          location?: string | null;
          meeting_title?: string;
          name: string;
          organization_id: string;
          start_time?: string | null;
        };
        Update: {
          agenda?: Json;
          created_at?: string;
          created_by?: string | null;
          id?: string;
          location?: string | null;
          meeting_title?: string;
          name?: string;
          organization_id?: string;
          start_time?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "meeting_templates_organization_id_fkey";
            columns: ["organization_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
        ];
      };
      meetings: {
        Row: {
          created_at: string;
          created_by: string | null;
          id: string;
          location: string | null;
          meeting_date: string;
          organization_id: string;
          start_time: string | null;
          status: Database["public"]["Enums"]["meeting_status"];
          title: string;
        };
        Insert: {
          created_at?: string;
          created_by?: string | null;
          id?: string;
          location?: string | null;
          meeting_date: string;
          organization_id: string;
          start_time?: string | null;
          status?: Database["public"]["Enums"]["meeting_status"];
          title: string;
        };
        Update: {
          created_at?: string;
          created_by?: string | null;
          id?: string;
          location?: string | null;
          meeting_date?: string;
          organization_id?: string;
          start_time?: string | null;
          status?: Database["public"]["Enums"]["meeting_status"];
          title?: string;
        };
        Relationships: [
          {
            foreignKeyName: "meetings_organization_id_fkey";
            columns: ["organization_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
        ];
      };
      member_votes: {
        Row: {
          attendance_id: string | null;
          created_at: string;
          id: string;
          motion_id: string;
          organization_id: string;
          person_name: string;
          user_id: string;
          vote: string;
        };
        Insert: {
          attendance_id?: string | null;
          created_at?: string;
          id?: string;
          motion_id: string;
          organization_id: string;
          person_name: string;
          user_id: string;
          vote: string;
        };
        Update: {
          attendance_id?: string | null;
          created_at?: string;
          id?: string;
          motion_id?: string;
          organization_id?: string;
          person_name?: string;
          user_id?: string;
          vote?: string;
        };
        Relationships: [
          {
            foreignKeyName: "member_votes_motion_id_fkey";
            columns: ["motion_id"];
            isOneToOne: false;
            referencedRelation: "motions";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "member_votes_organization_id_fkey";
            columns: ["organization_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
        ];
      };
      memberships: {
        Row: {
          created_at: string;
          id: string;
          organization_id: string;
          role: Database["public"]["Enums"]["org_role"];
          user_id: string;
        };
        Insert: {
          created_at?: string;
          id?: string;
          organization_id: string;
          role?: Database["public"]["Enums"]["org_role"];
          user_id: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          organization_id?: string;
          role?: Database["public"]["Enums"]["org_role"];
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "memberships_organization_id_fkey";
            columns: ["organization_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
        ];
      };
      minutes: {
        Row: {
          approved_at: string | null;
          approved_by: string | null;
          content: string;
          created_at: string;
          created_by: string | null;
          id: string;
          meeting_id: string;
          organization_id: string;
          status: Database["public"]["Enums"]["minutes_status"];
          submitted_at: string | null;
          version: number;
        };
        Insert: {
          approved_at?: string | null;
          approved_by?: string | null;
          content?: string;
          created_at?: string;
          created_by?: string | null;
          id?: string;
          meeting_id: string;
          organization_id: string;
          status?: Database["public"]["Enums"]["minutes_status"];
          submitted_at?: string | null;
          version: number;
        };
        Update: {
          approved_at?: string | null;
          approved_by?: string | null;
          content?: string;
          created_at?: string;
          created_by?: string | null;
          id?: string;
          meeting_id?: string;
          organization_id?: string;
          status?: Database["public"]["Enums"]["minutes_status"];
          submitted_at?: string | null;
          version?: number;
        };
        Relationships: [
          {
            foreignKeyName: "minutes_meeting_id_fkey";
            columns: ["meeting_id"];
            isOneToOne: false;
            referencedRelation: "meetings";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "minutes_organization_id_fkey";
            columns: ["organization_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
        ];
      };
      motions: {
        Row: {
          agenda_item_id: string | null;
          closed_at: string | null;
          closed_by: string | null;
          closes_at: string | null;
          created_at: string;
          disposition_at: string | null;
          disposition_by: string | null;
          disposition_note: string | null;
          disposition_source: string | null;
          id: string;
          meeting_id: string;
          motion_text: string;
          moved_by: string | null;
          opened_at: string | null;
          opened_by: string | null;
          organization_id: string;
          outcome: Database["public"]["Enums"]["motion_outcome"];
          roll_call: Json | null;
          seconded_by: string | null;
          vote_record: Json | null;
          votes_abstain: number;
          votes_no: number;
          votes_recused: number;
          votes_yes: number;
          voting_status: string;
        };
        Insert: {
          agenda_item_id?: string | null;
          closed_at?: string | null;
          closed_by?: string | null;
          closes_at?: string | null;
          created_at?: string;
          disposition_at?: string | null;
          disposition_by?: string | null;
          disposition_note?: string | null;
          disposition_source?: string | null;
          id?: string;
          meeting_id: string;
          motion_text: string;
          moved_by?: string | null;
          opened_at?: string | null;
          opened_by?: string | null;
          organization_id: string;
          outcome?: Database["public"]["Enums"]["motion_outcome"];
          roll_call?: Json | null;
          seconded_by?: string | null;
          vote_record?: Json | null;
          votes_abstain?: number;
          votes_no?: number;
          votes_recused?: number;
          votes_yes?: number;
          voting_status?: string;
        };
        Update: {
          agenda_item_id?: string | null;
          closed_at?: string | null;
          closed_by?: string | null;
          closes_at?: string | null;
          created_at?: string;
          disposition_at?: string | null;
          disposition_by?: string | null;
          disposition_note?: string | null;
          disposition_source?: string | null;
          id?: string;
          meeting_id?: string;
          motion_text?: string;
          moved_by?: string | null;
          opened_at?: string | null;
          opened_by?: string | null;
          organization_id?: string;
          outcome?: Database["public"]["Enums"]["motion_outcome"];
          roll_call?: Json | null;
          seconded_by?: string | null;
          vote_record?: Json | null;
          votes_abstain?: number;
          votes_no?: number;
          votes_recused?: number;
          votes_yes?: number;
          voting_status?: string;
        };
        Relationships: [
          {
            foreignKeyName: "motions_agenda_item_id_fkey";
            columns: ["agenda_item_id"];
            isOneToOne: false;
            referencedRelation: "agenda_items";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "motions_meeting_id_fkey";
            columns: ["meeting_id"];
            isOneToOne: false;
            referencedRelation: "meetings";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "motions_organization_id_fkey";
            columns: ["organization_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
        ];
      };
      organization_letterheads: {
        Row: {
          file_name: string;
          footer_points: number;
          header_points: number;
          id: string;
          mime_type: string;
          organization_id: string;
          storage_path: string;
          updated_at: string;
        };
        Insert: {
          file_name: string;
          footer_points?: number;
          header_points?: number;
          id?: string;
          mime_type: string;
          organization_id: string;
          storage_path: string;
          updated_at?: string;
        };
        Update: {
          file_name?: string;
          footer_points?: number;
          header_points?: number;
          id?: string;
          mime_type?: string;
          organization_id?: string;
          storage_path?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "organization_letterheads_organization_id_fkey";
            columns: ["organization_id"];
            isOneToOne: true;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
        ];
      };
      organizations: {
        Row: {
          created_at: string;
          created_by: string;
          decision_rule: string;
          id: string;
          name: string;
          quorum_count: number;
          seconder_required: boolean;
          timezone: string;
          vote_close_modes: string[];
          vote_closer_roles: Database["public"]["Enums"]["org_role"][];
          vote_recording: string;
          vote_timer_minutes: number | null;
        };
        Insert: {
          created_at?: string;
          created_by: string;
          decision_rule?: string;
          id?: string;
          name: string;
          quorum_count?: number;
          seconder_required?: boolean;
          timezone?: string;
          vote_close_modes?: string[];
          vote_closer_roles?: Database["public"]["Enums"]["org_role"][];
          vote_recording?: string;
          vote_timer_minutes?: number | null;
        };
        Update: {
          created_at?: string;
          created_by?: string;
          decision_rule?: string;
          id?: string;
          name?: string;
          quorum_count?: number;
          seconder_required?: boolean;
          timezone?: string;
          vote_close_modes?: string[];
          vote_closer_roles?: Database["public"]["Enums"]["org_role"][];
          vote_recording?: string;
          vote_timer_minutes?: number | null;
        };
        Relationships: [];
      };
      packets: {
        Row: {
          contents: Json;
          created_at: string;
          created_by: string | null;
          distributed_at: string | null;
          id: string;
          meeting_id: string;
          organization_id: string;
          storage_path: string;
          version: number;
        };
        Insert: {
          contents?: Json;
          created_at?: string;
          created_by?: string | null;
          distributed_at?: string | null;
          id?: string;
          meeting_id: string;
          organization_id: string;
          storage_path: string;
          version: number;
        };
        Update: {
          contents?: Json;
          created_at?: string;
          created_by?: string | null;
          distributed_at?: string | null;
          id?: string;
          meeting_id?: string;
          organization_id?: string;
          storage_path?: string;
          version?: number;
        };
        Relationships: [
          {
            foreignKeyName: "packets_meeting_id_fkey";
            columns: ["meeting_id"];
            isOneToOne: false;
            referencedRelation: "meetings";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "packets_organization_id_fkey";
            columns: ["organization_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
        ];
      };
      profiles: {
        Row: {
          created_at: string;
          email: string | null;
          full_name: string | null;
          id: string;
        };
        Insert: {
          created_at?: string;
          email?: string | null;
          full_name?: string | null;
          id: string;
        };
        Update: {
          created_at?: string;
          email?: string | null;
          full_name?: string | null;
          id?: string;
        };
        Relationships: [];
      };
      vote_electorate: {
        Row: {
          attendance_id: string | null;
          created_at: string;
          id: string;
          motion_id: string;
          organization_id: string;
          person_name: string;
          user_id: string;
        };
        Insert: {
          attendance_id?: string | null;
          created_at?: string;
          id?: string;
          motion_id: string;
          organization_id: string;
          person_name: string;
          user_id: string;
        };
        Update: {
          attendance_id?: string | null;
          created_at?: string;
          id?: string;
          motion_id?: string;
          organization_id?: string;
          person_name?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "vote_electorate_motion_id_fkey";
            columns: ["motion_id"];
            isOneToOne: false;
            referencedRelation: "motions";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "vote_electorate_organization_id_fkey";
            columns: ["organization_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
        ];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      accept_invitation: { Args: { _token: string }; Returns: string };
      can_edit_records: { Args: { _org: string }; Returns: boolean };
      can_manage_org: { Args: { _org: string }; Returns: boolean };
      cast_vote: { Args: { _motion: string; _vote: string }; Returns: string };
      close_vote: { Args: { _motion: string }; Returns: undefined };
      create_invitation: {
        Args: {
          _email: string;
          _org: string;
          _role: Database["public"]["Enums"]["org_role"];
        };
        Returns: string;
      };
      create_organization: {
        Args: { _name: string; _timezone?: string };
        Returns: string;
      };
      finish_vote: {
        Args: { _how: string; _motion: string };
        Returns: undefined;
      };
      has_org_role: {
        Args: {
          _org: string;
          _roles: Database["public"]["Enums"]["org_role"][];
        };
        Returns: boolean;
      };
      is_org_member: { Args: { _org: string }; Returns: boolean };
      record_disposition: {
        Args: {
          _motion: string;
          _note: string;
          _outcome: Database["public"]["Enums"]["motion_outcome"];
        };
        Returns: undefined;
      };
      shares_org_with: { Args: { _user: string }; Returns: boolean };
      start_vote: {
        Args: {
          _agenda_item: string;
          _meeting: string;
          _moved_by: string;
          _seconded_by: string;
          _text: string;
        };
        Returns: string;
      };
      vote_is_closed: { Args: { _motion: string }; Returns: boolean };
      vote_progress: { Args: { _motion: string }; Returns: Json };
    };
    Enums: {
      attendance_status: "present" | "absent" | "excused" | "remote";
      meeting_status: "draft" | "scheduled" | "in_progress" | "completed" | "archived";
      minutes_status: "draft" | "submitted" | "approved" | "superseded";
      motion_outcome: "pending" | "carried" | "failed" | "tabled" | "withdrawn";
      org_role: "owner" | "admin" | "chair" | "secretary" | "treasurer" | "member" | "observer";
      task_status: "open" | "in_progress" | "done" | "cancelled";
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">;

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">];

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
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] & DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
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
    keyof DefaultSchema["CompositeTypes"] | { schema: keyof DatabaseWithoutInternals },
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
  public: {
    Enums: {
      attendance_status: ["present", "absent", "excused", "remote"],
      meeting_status: ["draft", "scheduled", "in_progress", "completed", "archived"],
      minutes_status: ["draft", "submitted", "approved", "superseded"],
      motion_outcome: ["pending", "carried", "failed", "tabled", "withdrawn"],
      org_role: ["owner", "admin", "chair", "secretary", "treasurer", "member", "observer"],
      task_status: ["open", "in_progress", "done", "cancelled"],
    },
  },
} as const;

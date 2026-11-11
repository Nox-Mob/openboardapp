export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  board: {
    Tables: {
      action_items: {
        Row: {
          assignee_id: string | null
          created_at: string
          created_by: string | null
          details: string | null
          due_date: string | null
          id: string
          meeting_id: string | null
          org_id: string
          status: Database["board"]["Enums"]["task_status"]
          title: string
        }
        ComputedFields: never
        Insert: {
          assignee_id?: string | null
          created_at?: string
          created_by?: string | null
          details?: string | null
          due_date?: string | null
          id?: string
          meeting_id?: string | null
          org_id: string
          status?: Database["board"]["Enums"]["task_status"]
          title: string
        }
        Update: {
          assignee_id?: string | null
          created_at?: string
          created_by?: string | null
          details?: string | null
          due_date?: string | null
          id?: string
          meeting_id?: string | null
          org_id?: string
          status?: Database["board"]["Enums"]["task_status"]
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "action_items_meeting_id_fkey"
            columns: ["meeting_id"]
            referencedRelation: "meetings"
            referencedColumns: ["id"]
          },
        ]
      }
      agenda_items: {
        Row: {
          created_at: string
          decision_rule: string | null
          description: string | null
          duration_minutes: number | null
          id: string
          is_vote_item: boolean
          meeting_id: string
          notes: string
          org_id: string
          position: number
          presenter: string | null
          proposed_motion: string | null
          title: string
        }
        ComputedFields: never
        Insert: {
          created_at?: string
          decision_rule?: string | null
          description?: string | null
          duration_minutes?: number | null
          id?: string
          is_vote_item?: boolean
          meeting_id: string
          notes?: string
          org_id: string
          position?: number
          presenter?: string | null
          proposed_motion?: string | null
          title: string
        }
        Update: {
          created_at?: string
          decision_rule?: string | null
          description?: string | null
          duration_minutes?: number | null
          id?: string
          is_vote_item?: boolean
          meeting_id?: string
          notes?: string
          org_id?: string
          position?: number
          presenter?: string | null
          proposed_motion?: string | null
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "agenda_items_meeting_id_fkey"
            columns: ["meeting_id"]
            referencedRelation: "meetings"
            referencedColumns: ["id"]
          },
        ]
      }
      attendance: {
        Row: {
          created_at: string
          id: string
          is_voting: boolean
          meeting_id: string
          org_id: string
          person_id: string | null
          person_name: string
          status: Database["board"]["Enums"]["attendance_status"]
          user_id: string | null
        }
        ComputedFields: never
        Insert: {
          created_at?: string
          id?: string
          is_voting?: boolean
          meeting_id: string
          org_id: string
          person_id?: string | null
          person_name: string
          status?: Database["board"]["Enums"]["attendance_status"]
          user_id?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          is_voting?: boolean
          meeting_id?: string
          org_id?: string
          person_id?: string | null
          person_name?: string
          status?: Database["board"]["Enums"]["attendance_status"]
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "attendance_meeting_id_fkey"
            columns: ["meeting_id"]
            referencedRelation: "meetings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attendance_person_id_fkey"
            columns: ["person_id"]
            referencedRelation: "people"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_log: {
        Row: {
          action: string
          actor_id: string | null
          created_at: string
          details: Json | null
          entity: string
          entity_id: string | null
          id: number
          org_id: string
          summary: string | null
        }
        ComputedFields: never
        Insert: {
          action: string
          actor_id?: string | null
          created_at?: string
          details?: Json | null
          entity: string
          entity_id?: string | null
          id?: never
          org_id: string
          summary?: string | null
        }
        Update: {
          action?: string
          actor_id?: string | null
          created_at?: string
          details?: Json | null
          entity?: string
          entity_id?: string | null
          id?: never
          org_id?: string
          summary?: string | null
        }
        Relationships: []
      }
      committee_members: {
        Row: {
          committee_id: string
          created_at: string
          id: string
          org_id: string
          person_id: string | null
          person_name: string
          role: string
          user_id: string | null
        }
        ComputedFields: never
        Insert: {
          committee_id: string
          created_at?: string
          id?: string
          org_id: string
          person_id?: string | null
          person_name: string
          role?: string
          user_id?: string | null
        }
        Update: {
          committee_id?: string
          created_at?: string
          id?: string
          org_id?: string
          person_id?: string | null
          person_name?: string
          role?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "committee_members_committee_id_fkey"
            columns: ["committee_id"]
            referencedRelation: "committees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "committee_members_person_id_fkey"
            columns: ["person_id"]
            referencedRelation: "people"
            referencedColumns: ["id"]
          },
        ]
      }
      committees: {
        Row: {
          created_at: string
          description: string | null
          id: string
          name: string
          org_id: string
        }
        ComputedFields: never
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          name: string
          org_id: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          name?: string
          org_id?: string
        }
        Relationships: []
      }
      document_versions: {
        Row: {
          created_at: string
          document_id: string
          file_name: string
          id: string
          mime_type: string | null
          org_id: string
          size_bytes: number | null
          storage_path: string
          uploaded_by: string | null
          version: number
        }
        ComputedFields: never
        Insert: {
          created_at?: string
          document_id: string
          file_name: string
          id?: string
          mime_type?: string | null
          org_id: string
          size_bytes?: number | null
          storage_path: string
          uploaded_by?: string | null
          version: number
        }
        Update: {
          created_at?: string
          document_id?: string
          file_name?: string
          id?: string
          mime_type?: string | null
          org_id?: string
          size_bytes?: number | null
          storage_path?: string
          uploaded_by?: string | null
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "document_versions_document_id_fkey"
            columns: ["document_id"]
            referencedRelation: "documents"
            referencedColumns: ["id"]
          },
        ]
      }
      documents: {
        Row: {
          category: string
          created_at: string
          created_by: string | null
          id: string
          meeting_id: string | null
          org_id: string
          title: string
        }
        ComputedFields: never
        Insert: {
          category?: string
          created_at?: string
          created_by?: string | null
          id?: string
          meeting_id?: string | null
          org_id: string
          title: string
        }
        Update: {
          category?: string
          created_at?: string
          created_by?: string | null
          id?: string
          meeting_id?: string | null
          org_id?: string
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "documents_meeting_id_fkey"
            columns: ["meeting_id"]
            referencedRelation: "meetings"
            referencedColumns: ["id"]
          },
        ]
      }
      letterheads: {
        Row: {
          file_name: string
          footer_points: number
          header_points: number
          id: string
          mime_type: string
          org_id: string
          storage_path: string
          updated_at: string
        }
        ComputedFields: never
        Insert: {
          file_name: string
          footer_points?: number
          header_points?: number
          id?: string
          mime_type: string
          org_id: string
          storage_path: string
          updated_at?: string
        }
        Update: {
          file_name?: string
          footer_points?: number
          header_points?: number
          id?: string
          mime_type?: string
          org_id?: string
          storage_path?: string
          updated_at?: string
        }
        Relationships: []
      }
      meeting_templates: {
        Row: {
          agenda: NonNullable<Json>
          created_at: string
          created_by: string | null
          id: string
          location: string | null
          meeting_title: string
          name: string
          org_id: string
          start_time: string | null
        }
        ComputedFields: never
        Insert: {
          agenda?: NonNullable<Json>
          created_at?: string
          created_by?: string | null
          id?: string
          location?: string | null
          meeting_title?: string
          name: string
          org_id: string
          start_time?: string | null
        }
        Update: {
          agenda?: NonNullable<Json>
          created_at?: string
          created_by?: string | null
          id?: string
          location?: string | null
          meeting_title?: string
          name?: string
          org_id?: string
          start_time?: string | null
        }
        Relationships: []
      }
      meetings: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          location: string | null
          meeting_date: string
          org_id: string
          start_time: string | null
          status: Database["board"]["Enums"]["meeting_status"]
          title: string
        }
        ComputedFields: never
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          location?: string | null
          meeting_date: string
          org_id: string
          start_time?: string | null
          status?: Database["board"]["Enums"]["meeting_status"]
          title: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          location?: string | null
          meeting_date?: string
          org_id?: string
          start_time?: string | null
          status?: Database["board"]["Enums"]["meeting_status"]
          title?: string
        }
        Relationships: []
      }
      member_votes: {
        Row: {
          attendance_id: string | null
          created_at: string
          id: string
          motion_id: string
          org_id: string
          person_name: string
          user_id: string
          vote: string
        }
        ComputedFields: never
        Insert: {
          attendance_id?: string | null
          created_at?: string
          id?: string
          motion_id: string
          org_id: string
          person_name: string
          user_id: string
          vote: string
        }
        Update: {
          attendance_id?: string | null
          created_at?: string
          id?: string
          motion_id?: string
          org_id?: string
          person_name?: string
          user_id?: string
          vote?: string
        }
        Relationships: [
          {
            foreignKeyName: "member_votes_motion_id_fkey"
            columns: ["motion_id"]
            referencedRelation: "motions"
            referencedColumns: ["id"]
          },
        ]
      }
      minutes: {
        Row: {
          approved_at: string | null
          approved_by: string | null
          content: string
          created_at: string
          created_by: string | null
          id: string
          meeting_id: string
          org_id: string
          status: Database["board"]["Enums"]["minutes_status"]
          submitted_at: string | null
          version: number
        }
        ComputedFields: never
        Insert: {
          approved_at?: string | null
          approved_by?: string | null
          content?: string
          created_at?: string
          created_by?: string | null
          id?: string
          meeting_id: string
          org_id: string
          status?: Database["board"]["Enums"]["minutes_status"]
          submitted_at?: string | null
          version: number
        }
        Update: {
          approved_at?: string | null
          approved_by?: string | null
          content?: string
          created_at?: string
          created_by?: string | null
          id?: string
          meeting_id?: string
          org_id?: string
          status?: Database["board"]["Enums"]["minutes_status"]
          submitted_at?: string | null
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "minutes_meeting_id_fkey"
            columns: ["meeting_id"]
            referencedRelation: "meetings"
            referencedColumns: ["id"]
          },
        ]
      }
      motions: {
        Row: {
          agenda_item_id: string | null
          closed_at: string | null
          closed_by: string | null
          closes_at: string | null
          created_at: string
          disposition_at: string | null
          disposition_by: string | null
          disposition_note: string | null
          disposition_source: string | null
          id: string
          meeting_id: string
          motion_text: string
          moved_by: string | null
          opened_at: string | null
          opened_by: string | null
          org_id: string
          outcome: Database["board"]["Enums"]["motion_outcome"]
          roll_call: Json | null
          seconded_by: string | null
          vote_record: Json | null
          votes_abstain: number
          votes_no: number
          votes_recused: number
          votes_yes: number
          voting_status: string
        }
        ComputedFields: never
        Insert: {
          agenda_item_id?: string | null
          closed_at?: string | null
          closed_by?: string | null
          closes_at?: string | null
          created_at?: string
          disposition_at?: string | null
          disposition_by?: string | null
          disposition_note?: string | null
          disposition_source?: string | null
          id?: string
          meeting_id: string
          motion_text: string
          moved_by?: string | null
          opened_at?: string | null
          opened_by?: string | null
          org_id: string
          outcome?: Database["board"]["Enums"]["motion_outcome"]
          roll_call?: Json | null
          seconded_by?: string | null
          vote_record?: Json | null
          votes_abstain?: number
          votes_no?: number
          votes_recused?: number
          votes_yes?: number
          voting_status?: string
        }
        Update: {
          agenda_item_id?: string | null
          closed_at?: string | null
          closed_by?: string | null
          closes_at?: string | null
          created_at?: string
          disposition_at?: string | null
          disposition_by?: string | null
          disposition_note?: string | null
          disposition_source?: string | null
          id?: string
          meeting_id?: string
          motion_text?: string
          moved_by?: string | null
          opened_at?: string | null
          opened_by?: string | null
          org_id?: string
          outcome?: Database["board"]["Enums"]["motion_outcome"]
          roll_call?: Json | null
          seconded_by?: string | null
          vote_record?: Json | null
          votes_abstain?: number
          votes_no?: number
          votes_recused?: number
          votes_yes?: number
          voting_status?: string
        }
        Relationships: [
          {
            foreignKeyName: "motions_agenda_item_id_fkey"
            columns: ["agenda_item_id"]
            referencedRelation: "agenda_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "motions_meeting_id_fkey"
            columns: ["meeting_id"]
            referencedRelation: "meetings"
            referencedColumns: ["id"]
          },
        ]
      }
      officers: {
        Row: {
          created_at: string
          office: Database["board"]["Enums"]["office"]
          org_id: string
          user_id: string
        }
        ComputedFields: never
        Insert: {
          created_at?: string
          office: Database["board"]["Enums"]["office"]
          org_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          office?: Database["board"]["Enums"]["office"]
          org_id?: string
          user_id?: string
        }
        Relationships: []
      }
      org_settings: {
        Row: {
          decision_rule: string
          org_id: string
          quorum_count: number
          seconder_required: boolean
          timezone: string
          updated_at: string
          vote_close_modes: string[]
          vote_closer_roles: string[]
          vote_recording: string
          vote_timer_minutes: number | null
        }
        ComputedFields: never
        Insert: {
          decision_rule?: string
          org_id: string
          quorum_count?: number
          seconder_required?: boolean
          timezone?: string
          updated_at?: string
          vote_close_modes?: string[]
          vote_closer_roles?: string[]
          vote_recording?: string
          vote_timer_minutes?: number | null
        }
        Update: {
          decision_rule?: string
          org_id?: string
          quorum_count?: number
          seconder_required?: boolean
          timezone?: string
          updated_at?: string
          vote_close_modes?: string[]
          vote_closer_roles?: string[]
          vote_recording?: string
          vote_timer_minutes?: number | null
        }
        Relationships: []
      }
      packets: {
        Row: {
          contents: NonNullable<Json>
          created_at: string
          created_by: string | null
          distributed_at: string | null
          id: string
          meeting_id: string
          org_id: string
          storage_path: string
          version: number
        }
        ComputedFields: never
        Insert: {
          contents?: NonNullable<Json>
          created_at?: string
          created_by?: string | null
          distributed_at?: string | null
          id?: string
          meeting_id: string
          org_id: string
          storage_path: string
          version: number
        }
        Update: {
          contents?: NonNullable<Json>
          created_at?: string
          created_by?: string | null
          distributed_at?: string | null
          id?: string
          meeting_id?: string
          org_id?: string
          storage_path?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "packets_meeting_id_fkey"
            columns: ["meeting_id"]
            referencedRelation: "meetings"
            referencedColumns: ["id"]
          },
        ]
      }
      people: {
        Row: {
          created_at: string
          email: string | null
          full_name: string
          id: string
          notes: string | null
          org_id: string
        }
        ComputedFields: never
        Insert: {
          created_at?: string
          email?: string | null
          full_name: string
          id?: string
          notes?: string | null
          org_id: string
        }
        Update: {
          created_at?: string
          email?: string | null
          full_name?: string
          id?: string
          notes?: string | null
          org_id?: string
        }
        Relationships: []
      }
      positions: {
        Row: {
          created_at: string
          id: string
          org_id: string
          sort_order: number
          term_years: number | null
          title: string
        }
        ComputedFields: never
        Insert: {
          created_at?: string
          id?: string
          org_id: string
          sort_order?: number
          term_years?: number | null
          title: string
        }
        Update: {
          created_at?: string
          id?: string
          org_id?: string
          sort_order?: number
          term_years?: number | null
          title?: string
        }
        Relationships: []
      }
      terms: {
        Row: {
          created_at: string
          end_date: string | null
          id: string
          notes: string | null
          org_id: string
          person_id: string | null
          person_name: string
          position: string
          position_id: string | null
          start_date: string
          user_id: string | null
        }
        ComputedFields: never
        Insert: {
          created_at?: string
          end_date?: string | null
          id?: string
          notes?: string | null
          org_id: string
          person_id?: string | null
          person_name: string
          position?: string
          position_id?: string | null
          start_date: string
          user_id?: string | null
        }
        Update: {
          created_at?: string
          end_date?: string | null
          id?: string
          notes?: string | null
          org_id?: string
          person_id?: string | null
          person_name?: string
          position?: string
          position_id?: string | null
          start_date?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "terms_person_id_fkey"
            columns: ["person_id"]
            referencedRelation: "people"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "terms_position_id_fkey"
            columns: ["position_id"]
            referencedRelation: "positions"
            referencedColumns: ["id"]
          },
        ]
      }
      vote_electorate: {
        Row: {
          attendance_id: string | null
          created_at: string
          id: string
          motion_id: string
          org_id: string
          person_name: string
          user_id: string
        }
        ComputedFields: never
        Insert: {
          attendance_id?: string | null
          created_at?: string
          id?: string
          motion_id: string
          org_id: string
          person_name: string
          user_id: string
        }
        Update: {
          attendance_id?: string | null
          created_at?: string
          id?: string
          motion_id?: string
          org_id?: string
          person_name?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "vote_electorate_motion_id_fkey"
            columns: ["motion_id"]
            referencedRelation: "motions"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      audit_org_ids: { Args: Record<PropertyKey, never>; Returns: string[] }
      can_edit_records: { Args: { p_org: string }; Returns: boolean }
      can_manage: { Args: { p_org: string }; Returns: boolean }
      can_read_audit: { Args: { p_org: string }; Returns: boolean }
      cast_vote: { Args: { p_motion: string; p_vote: string }; Returns: string }
      close_vote: { Args: { p_motion: string }; Returns: undefined }
      editable_org_ids: { Args: Record<PropertyKey, never>; Returns: string[] }
      finish_vote: {
        Args: { p_how: string; p_motion: string }
        Returns: undefined
      }
      holds_any: {
        Args: { p_org: string; p_roles: string[] }
        Returns: boolean
      }
      managed_org_ids: { Args: Record<PropertyKey, never>; Returns: string[] }
      my_office: {
        Args: { p_org: string }
        Returns: Database["board"]["Enums"]["office"]
      }
      on_invitation_accepted: {
        Args: { p_invitation_id: string }
        Returns: undefined
      }
      org_gone: { Args: { p_org: string }; Returns: boolean }
      readable_org_ids: { Args: Record<PropertyKey, never>; Returns: string[] }
      record_disposition: {
        Args: {
          p_motion: string
          p_note: string
          p_outcome: Database["board"]["Enums"]["motion_outcome"]
        }
        Returns: undefined
      }
      settings: {
        Args: { p_org: string }
        Returns: {
          decision_rule: string
          org_id: string
          quorum_count: number
          seconder_required: boolean
          timezone: string
          updated_at: string
          vote_close_modes: string[]
          vote_closer_roles: string[]
          vote_recording: string
          vote_timer_minutes: number | null
        }
        SetofOptions: {
          from: "*"
          to: "org_settings"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      start_vote: {
        Args: {
          p_agenda_item: string
          p_meeting: string
          p_moved_by: string
          p_seconded_by: string
          p_text: string
        }
        Returns: string
      }
      vote_is_closed: { Args: { p_motion: string }; Returns: boolean }
      vote_progress: { Args: { p_motion: string }; Returns: Json }
    }
    Enums: {
      attendance_status: "present" | "absent" | "excused" | "remote"
      meeting_status:
        | "draft"
        | "scheduled"
        | "in_progress"
        | "completed"
        | "archived"
      minutes_status: "draft" | "submitted" | "approved" | "superseded"
      motion_outcome: "pending" | "carried" | "failed" | "tabled" | "withdrawn"
      office: "chair" | "secretary" | "treasurer"
      task_status: "open" | "in_progress" | "done" | "cancelled"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  public: {
    Tables: {
      instance_settings: {
        Row: {
          billing_enabled: boolean
          hub_url: string | null
          id: boolean
        }
        ComputedFields: never
        Insert: {
          billing_enabled?: boolean
          hub_url?: string | null
          id?: boolean
        }
        Update: {
          billing_enabled?: boolean
          hub_url?: string | null
          id?: boolean
        }
        Relationships: []
      }
      invitations: {
        Row: {
          accepted_at: string | null
          accepted_by: string | null
          app: string | null
          app_payload: NonNullable<Json>
          created_at: string
          email: string | null
          expires_at: string
          id: string
          invited_by: string | null
          org_id: string
          revoked_at: string | null
          role: Database["public"]["Enums"]["org_role"] | null
          token_hash: string
        }
        ComputedFields: never
        Insert: {
          accepted_at?: string | null
          accepted_by?: string | null
          app?: string | null
          app_payload?: NonNullable<Json>
          created_at?: string
          email?: string | null
          expires_at: string
          id?: string
          invited_by?: string | null
          org_id: string
          revoked_at?: string | null
          role?: Database["public"]["Enums"]["org_role"] | null
          token_hash: string
        }
        Update: {
          accepted_at?: string | null
          accepted_by?: string | null
          app?: string | null
          app_payload?: NonNullable<Json>
          created_at?: string
          email?: string | null
          expires_at?: string
          id?: string
          invited_by?: string | null
          org_id?: string
          revoked_at?: string | null
          role?: Database["public"]["Enums"]["org_role"] | null
          token_hash?: string
        }
        Relationships: [
          {
            foreignKeyName: "invitations_org_id_fkey"
            columns: ["org_id"]
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      memberships: {
        Row: {
          created_at: string
          org_id: string
          role: Database["public"]["Enums"]["org_role"]
          user_id: string
        }
        ComputedFields: never
        Insert: {
          created_at?: string
          org_id: string
          role?: Database["public"]["Enums"]["org_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          org_id?: string
          role?: Database["public"]["Enums"]["org_role"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "memberships_org_id_fkey"
            columns: ["org_id"]
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      organizations: {
        Row: {
          created_at: string
          created_by: string | null
          currency: string
          id: string
          name: string
          slug: string | null
          time_zone: string
        }
        ComputedFields: never
        Insert: {
          created_at?: string
          created_by?: string | null
          currency?: string
          id?: string
          name: string
          slug?: string | null
          time_zone?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          currency?: string
          id?: string
          name?: string
          slug?: string | null
          time_zone?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          display_name: string | null
          id: string
          updated_at: string
        }
        ComputedFields: never
        Insert: {
          avatar_url?: string | null
          display_name?: string | null
          id: string
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          display_name?: string | null
          id?: string
          updated_at?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      _clean_org_name: { Args: { p_name: string }; Returns: string }
      _is_active_user: { Args: { p_user: string }; Returns: boolean }
      _member_confirm_text: { Args: { p_user: string }; Returns: string }
      _require_uid: { Args: Record<PropertyKey, never>; Returns: string }
      _token_hash: { Args: { p_token: string }; Returns: string }
      accept_invitation: {
        Args: { p_token: string }
        Returns: {
          app: string
          app_payload: Json
          id: string
          org_id: string
          role: Database["public"]["Enums"]["org_role"]
        }[]
      }
      can_write: { Args: { p_app: string; p_org: string }; Returns: boolean }
      create_invitation: {
        Args: {
          p_app?: string
          p_days?: number
          p_email: string
          p_org: string
          p_payload?: Json
          p_role: Database["public"]["Enums"]["org_role"]
        }
        Returns: {
          invitation_id: string
          token: string
        }[]
      }
      create_organization: { Args: { p_name: string }; Returns: string }
      delete_organization: {
        Args: { p_confirm_name: string; p_org: string }
        Returns: undefined
      }
      get_invitation: {
        Args: { p_token: string }
        Returns: {
          app: string
          email: string
          org_name: string
          role: Database["public"]["Enums"]["org_role"]
          status: string
        }[]
      }
      has_app_access: {
        Args: { p_app: string; p_org: string }
        Returns: boolean
      }
      has_role: {
        Args: {
          p_org: string
          p_roles: Database["public"]["Enums"]["org_role"][]
        }
        Returns: boolean
      }
      is_member: { Args: { p_org: string }; Returns: boolean }
      list_invitations: {
        Args: { p_org: string }
        Returns: {
          app: string
          created_at: string
          email: string
          expires_at: string
          id: string
          invited_by: string
          invited_by_name: string
          role: Database["public"]["Enums"]["org_role"]
          status: string
        }[]
      }
      org_member_directory: {
        Args: { p_org: string }
        Returns: {
          display_name: string
          email: string
          role: Database["public"]["Enums"]["org_role"]
          user_id: string
        }[]
      }
      ownership_transfer_candidates: {
        Args: { p_org: string }
        Returns: {
          display_name: string
          email: string
          role: Database["public"]["Enums"]["org_role"]
          user_id: string
        }[]
      }
      rename_organization: {
        Args: { p_name: string; p_org: string }
        Returns: undefined
      }
      revoke_invitation: { Args: { p_id: string }; Returns: undefined }
      set_organization_preferences: {
        Args: { p_currency: string; p_org: string; p_time_zone: string }
        Returns: undefined
      }
      shares_org: { Args: { p_user: string }; Returns: boolean }
      transfer_ownership:
        | { Args: { p_new_owner: string; p_org: string }; Returns: undefined }
        | {
            Args: { p_confirm: string; p_new_owner: string; p_org: string }
            Returns: undefined
          }
    }
    Enums: {
      org_role: "owner" | "admin" | "member" | "viewer"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

// Board's own schema is the default for Tables<…>, TablesInsert<…>, Enums<…> (the client uses db.schema "board").
type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "board">]

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
  board: {
    Enums: {
      attendance_status: ["present", "absent", "excused", "remote"],
      meeting_status: [
        "draft",
        "scheduled",
        "in_progress",
        "completed",
        "archived",
      ],
      minutes_status: ["draft", "submitted", "approved", "superseded"],
      motion_outcome: ["pending", "carried", "failed", "tabled", "withdrawn"],
      office: ["chair", "secretary", "treasurer"],
      task_status: ["open", "in_progress", "done", "cancelled"],
    },
  },
  public: {
    Enums: {
      org_role: ["owner", "admin", "member", "viewer"],
    },
  },
} as const

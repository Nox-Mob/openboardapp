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
            isOneToOne: false
            referencedRelation: "api_meetings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "action_items_meeting_id_fkey"
            columns: ["meeting_id"]
            isOneToOne: false
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
            isOneToOne: false
            referencedRelation: "api_meetings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agenda_items_meeting_id_fkey"
            columns: ["meeting_id"]
            isOneToOne: false
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
            isOneToOne: false
            referencedRelation: "api_meetings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attendance_meeting_id_fkey"
            columns: ["meeting_id"]
            isOneToOne: false
            referencedRelation: "meetings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attendance_person_id_fkey"
            columns: ["person_id"]
            isOneToOne: false
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
            isOneToOne: false
            referencedRelation: "committees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "committee_members_person_id_fkey"
            columns: ["person_id"]
            isOneToOne: false
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
            isOneToOne: false
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
            isOneToOne: false
            referencedRelation: "api_meetings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "documents_meeting_id_fkey"
            columns: ["meeting_id"]
            isOneToOne: false
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
          agenda: Json
          created_at: string
          created_by: string | null
          id: string
          location: string | null
          meeting_title: string
          name: string
          org_id: string
          start_time: string | null
        }
        Insert: {
          agenda?: Json
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
          agenda?: Json
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
            isOneToOne: false
            referencedRelation: "api_decisions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "member_votes_motion_id_fkey"
            columns: ["motion_id"]
            isOneToOne: false
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
            isOneToOne: false
            referencedRelation: "api_meetings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "minutes_meeting_id_fkey"
            columns: ["meeting_id"]
            isOneToOne: false
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
            isOneToOne: false
            referencedRelation: "agenda_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "motions_meeting_id_fkey"
            columns: ["meeting_id"]
            isOneToOne: false
            referencedRelation: "api_meetings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "motions_meeting_id_fkey"
            columns: ["meeting_id"]
            isOneToOne: false
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
          contents: Json
          created_at: string
          created_by: string | null
          distributed_at: string | null
          id: string
          meeting_id: string
          org_id: string
          storage_path: string
          version: number
        }
        Insert: {
          contents?: Json
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
          contents?: Json
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
            isOneToOne: false
            referencedRelation: "api_meetings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "packets_meeting_id_fkey"
            columns: ["meeting_id"]
            isOneToOne: false
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
          source: string | null
          source_id: string | null
          start_date: string
          user_id: string | null
        }
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
          source?: string | null
          source_id?: string | null
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
          source?: string | null
          source_id?: string | null
          start_date?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "terms_person_id_fkey"
            columns: ["person_id"]
            isOneToOne: false
            referencedRelation: "people"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "terms_position_id_fkey"
            columns: ["position_id"]
            isOneToOne: false
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
            isOneToOne: false
            referencedRelation: "api_decisions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vote_electorate_motion_id_fkey"
            columns: ["motion_id"]
            isOneToOne: false
            referencedRelation: "motions"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      api_action_items: {
        Row: {
          assignee_id: string | null
          completable: boolean | null
          created_at: string | null
          due_date: string | null
          id: string | null
          link: string | null
          meeting_id: string | null
          meeting_title: string | null
          org_id: string | null
          status: string | null
          title: string | null
        }
        Relationships: [
          {
            foreignKeyName: "action_items_meeting_id_fkey"
            columns: ["meeting_id"]
            isOneToOne: false
            referencedRelation: "api_meetings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "action_items_meeting_id_fkey"
            columns: ["meeting_id"]
            isOneToOne: false
            referencedRelation: "meetings"
            referencedColumns: ["id"]
          },
        ]
      }
      api_decisions: {
        Row: {
          decided_at: string | null
          id: string | null
          meeting_date: string | null
          meeting_id: string | null
          meeting_title: string | null
          motion_text: string | null
          org_id: string | null
          outcome: string | null
          votes_abstain: number | null
          votes_no: number | null
          votes_recused: number | null
          votes_yes: number | null
        }
        Relationships: [
          {
            foreignKeyName: "motions_meeting_id_fkey"
            columns: ["meeting_id"]
            isOneToOne: false
            referencedRelation: "api_meetings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "motions_meeting_id_fkey"
            columns: ["meeting_id"]
            isOneToOne: false
            referencedRelation: "meetings"
            referencedColumns: ["id"]
          },
        ]
      }
      api_meetings: {
        Row: {
          created_at: string | null
          id: string | null
          location: string | null
          meeting_date: string | null
          minutes_status: string | null
          motion_count: number | null
          org_id: string | null
          start_time: string | null
          status: string | null
          title: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string | null
          location?: string | null
          meeting_date?: string | null
          minutes_status?: never
          motion_count?: never
          org_id?: string | null
          start_time?: string | null
          status?: never
          title?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string | null
          location?: string | null
          meeting_date?: string | null
          minutes_status?: never
          motion_count?: never
          org_id?: string | null
          start_time?: string | null
          status?: never
          title?: string | null
        }
        Relationships: []
      }
      api_people: {
        Row: {
          office: string | null
          org_id: string | null
          user_id: string | null
        }
        Insert: {
          office?: never
          org_id?: string | null
          user_id?: string | null
        }
        Update: {
          office?: never
          org_id?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      _wf_meeting_ctx: {
        Args: {
          p_days: number
          p_meeting: Database["board"]["Tables"]["meetings"]["Row"]
        }
        Returns: Json
      }
      add_document: {
        Args: {
          p_category: string
          p_file_name: string
          p_id: string
          p_meeting_id: string
          p_mime_type: string
          p_org: string
          p_size_bytes: number
          p_storage_path: string
          p_title: string
        }
        Returns: string
      }
      add_report_to_meeting: {
        Args: {
          p_file_name: string
          p_meeting: string
          p_source_app?: string
          p_title: string
        }
        Returns: {
          document_id: string
          storage_path: string
        }[]
      }
      assign_term: {
        Args: {
          p_end_date?: string
          p_org: string
          p_person_name: string
          p_position: string
          p_position_id: string
          p_start_date: string
          p_user_id: string
        }
        Returns: string
      }
      audit_org_ids: { Args: never; Returns: string[] }
      can_edit_records: { Args: { p_org: string }; Returns: boolean }
      can_manage: { Args: { p_org: string }; Returns: boolean }
      can_read_audit: { Args: { p_org: string }; Returns: boolean }
      cast_vote: { Args: { p_motion: string; p_vote: string }; Returns: string }
      close_vote: { Args: { p_motion: string }; Returns: undefined }
      complete_action_item: { Args: { p_id: string }; Returns: undefined }
      create_meeting_with_agenda: {
        Args: {
          p_agenda?: Json
          p_location?: string
          p_meeting_date: string
          p_org: string
          p_start_time?: string
          p_title: string
        }
        Returns: string
      }
      editable_org_ids: { Args: never; Returns: string[] }
      finish_vote: {
        Args: { p_how: string; p_motion: string }
        Returns: undefined
      }
      holds_any: {
        Args: { p_org: string; p_roles: string[] }
        Returns: boolean
      }
      managed_org_ids: { Args: never; Returns: string[] }
      my_office: {
        Args: { p_org: string }
        Returns: Database["board"]["Enums"]["office"]
      }
      on_invitation_accepted: {
        Args: { p_invitation_id: string }
        Returns: undefined
      }
      org_gone: { Args: { p_org: string }; Returns: boolean }
      queue_email_reminders: { Args: never; Returns: number }
      readable_org_ids: { Args: never; Returns: string[] }
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
      sync_term_from_charter: {
        Args: {
          p_appointment: string
          p_end: string
          p_org: string
          p_person_name: string
          p_position: string
          p_removed?: boolean
          p_start: string
          p_user_id: string
        }
        Returns: undefined
      }
      vote_is_closed: { Args: { p_motion: string }; Returns: boolean }
      vote_progress: { Args: { p_motion: string }; Returns: Json }
      wf_action_item_overdue: {
        Args: { p_org: string; p_params: Json }
        Returns: {
          ctx: Json
          dedupe: string
        }[]
      }
      wf_meeting_upcoming: {
        Args: { p_org: string; p_params: Json }
        Returns: {
          ctx: Json
          dedupe: string
        }[]
      }
      wf_office_holders: {
        Args: { p_ctx: Json; p_org: string; p_params: Json }
        Returns: {
          email: string
          user_id: string
        }[]
      }
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
      _core_migration_marks: {
        Row: {
          done_at: string
          mark: string
        }
        Insert: {
          done_at?: string
          mark: string
        }
        Update: {
          done_at?: string
          mark?: string
        }
        Relationships: []
      }
      app_permission_types: {
        Row: {
          app: string
          description: string
          key: string
          label: string
          sort: number
        }
        Insert: {
          app: string
          description?: string
          key: string
          label: string
          sort?: number
        }
        Update: {
          app?: string
          description?: string
          key?: string
          label?: string
          sort?: number
        }
        Relationships: []
      }
      app_role_overrides: {
        Row: {
          app: string
          org_id: string
          role: Database["public"]["Enums"]["org_role"]
          set_at: string
          set_by: string | null
          user_id: string
        }
        Insert: {
          app: string
          org_id: string
          role: Database["public"]["Enums"]["org_role"]
          set_at?: string
          set_by?: string | null
          user_id: string
        }
        Update: {
          app?: string
          org_id?: string
          role?: Database["public"]["Enums"]["org_role"]
          set_at?: string
          set_by?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "app_role_overrides_org_id_user_id_fkey"
            columns: ["org_id", "user_id"]
            isOneToOne: false
            referencedRelation: "memberships"
            referencedColumns: ["org_id", "user_id"]
          },
        ]
      }
      automation_action_types: {
        Row: {
          app: string
          description: string
          label: string
          params_schema: Json
          requires: string[]
          sort: number
          type: string
        }
        Insert: {
          app: string
          description?: string
          label: string
          params_schema?: Json
          requires?: string[]
          sort?: number
          type: string
        }
        Update: {
          app?: string
          description?: string
          label?: string
          params_schema?: Json
          requires?: string[]
          sort?: number
          type?: string
        }
        Relationships: []
      }
      automation_editors: {
        Row: {
          granted_at: string
          granted_by: string | null
          org_id: string
          user_id: string
        }
        Insert: {
          granted_at?: string
          granted_by?: string | null
          org_id: string
          user_id: string
        }
        Update: {
          granted_at?: string
          granted_by?: string | null
          org_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "automation_editors_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      automation_events: {
        Row: {
          ctx: Json
          id: number
          occurred_at: string
          org_id: string
          processed_at: string | null
          type: string
        }
        Insert: {
          ctx?: Json
          id?: never
          occurred_at?: string
          org_id: string
          processed_at?: string | null
          type: string
        }
        Update: {
          ctx?: Json
          id?: never
          occurred_at?: string
          org_id?: string
          processed_at?: string | null
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "automation_events_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      automation_jobs: {
        Row: {
          app: string
          attempts: number
          created_at: string
          error: string | null
          id: number
          kind: string
          org_id: string
          payload: Json
          result: Json | null
          run_id: number | null
          status: string
          updated_at: string
        }
        Insert: {
          app: string
          attempts?: number
          created_at?: string
          error?: string | null
          id?: never
          kind: string
          org_id: string
          payload?: Json
          result?: Json | null
          run_id?: number | null
          status?: string
          updated_at?: string
        }
        Update: {
          app?: string
          attempts?: number
          created_at?: string
          error?: string | null
          id?: never
          kind?: string
          org_id?: string
          payload?: Json
          result?: Json | null
          run_id?: number | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "automation_jobs_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "automation_jobs_run_id_fkey"
            columns: ["run_id"]
            isOneToOne: false
            referencedRelation: "automation_runs"
            referencedColumns: ["id"]
          },
        ]
      }
      automation_kinds: {
        Row: {
          app: string
          category: string
          default_enabled: boolean
          default_params: Json
          description: string
          key: string
          name: string
          params_schema: Json
          sort: number
        }
        Insert: {
          app: string
          category?: string
          default_enabled?: boolean
          default_params?: Json
          description: string
          key: string
          name: string
          params_schema?: Json
          sort?: number
        }
        Update: {
          app?: string
          category?: string
          default_enabled?: boolean
          default_params?: Json
          description?: string
          key?: string
          name?: string
          params_schema?: Json
          sort?: number
        }
        Relationships: []
      }
      automation_log: {
        Row: {
          at: string
          count: number
          id: number
          kind: string
          org_id: string
          summary: string
        }
        Insert: {
          at?: string
          count?: number
          id?: never
          kind: string
          org_id: string
          summary: string
        }
        Update: {
          at?: string
          count?: number
          id?: never
          kind?: string
          org_id?: string
          summary?: string
        }
        Relationships: [
          {
            foreignKeyName: "automation_log_kind_fkey"
            columns: ["kind"]
            isOneToOne: false
            referencedRelation: "automation_kinds"
            referencedColumns: ["key"]
          },
          {
            foreignKeyName: "automation_log_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      automation_org_settings: {
        Row: {
          chapters_may_build: boolean
          org_id: string
          updated_at: string
        }
        Insert: {
          chapters_may_build?: boolean
          org_id: string
          updated_at?: string
        }
        Update: {
          chapters_may_build?: boolean
          org_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "automation_org_settings_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: true
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      automation_recipient_types: {
        Row: {
          app: string
          description: string
          label: string
          options_fn: string | null
          params_schema: Json
          resolve_fn: string
          sort: number
          type: string
        }
        Insert: {
          app: string
          description?: string
          label: string
          options_fn?: string | null
          params_schema?: Json
          resolve_fn: string
          sort?: number
          type: string
        }
        Update: {
          app?: string
          description?: string
          label?: string
          options_fn?: string | null
          params_schema?: Json
          resolve_fn?: string
          sort?: number
          type?: string
        }
        Relationships: []
      }
      automation_runs: {
        Row: {
          branch: string | null
          ctx: Json
          dedupe_key: string
          error: string | null
          finished_at: string | null
          id: number
          log: Json
          org_id: string
          started_at: string
          status: string
          trigger_type: string
          workflow_id: string
        }
        Insert: {
          branch?: string | null
          ctx?: Json
          dedupe_key: string
          error?: string | null
          finished_at?: string | null
          id?: never
          log?: Json
          org_id: string
          started_at?: string
          status?: string
          trigger_type: string
          workflow_id: string
        }
        Update: {
          branch?: string | null
          ctx?: Json
          dedupe_key?: string
          error?: string | null
          finished_at?: string | null
          id?: never
          log?: Json
          org_id?: string
          started_at?: string
          status?: string
          trigger_type?: string
          workflow_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "automation_runs_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "automation_runs_workflow_id_fkey"
            columns: ["workflow_id"]
            isOneToOne: false
            referencedRelation: "automation_workflows"
            referencedColumns: ["id"]
          },
        ]
      }
      automation_tasks: {
        Row: {
          assignee_id: string
          created_at: string
          done_at: string | null
          done_by: string | null
          due_on: string | null
          id: string
          link: string | null
          note: string
          org_id: string
          run_id: number | null
          status: string
          title: string
        }
        Insert: {
          assignee_id: string
          created_at?: string
          done_at?: string | null
          done_by?: string | null
          due_on?: string | null
          id?: string
          link?: string | null
          note?: string
          org_id: string
          run_id?: number | null
          status?: string
          title: string
        }
        Update: {
          assignee_id?: string
          created_at?: string
          done_at?: string | null
          done_by?: string | null
          due_on?: string | null
          id?: string
          link?: string | null
          note?: string
          org_id?: string
          run_id?: number | null
          status?: string
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "automation_tasks_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "automation_tasks_run_id_fkey"
            columns: ["run_id"]
            isOneToOne: false
            referencedRelation: "automation_runs"
            referencedColumns: ["id"]
          },
        ]
      }
      automation_trigger_types: {
        Row: {
          app: string
          description: string
          fields: Json
          fields_fn: string | null
          kind: string
          label: string
          params_schema: Json
          provides: string[]
          scan_fn: string | null
          sort: number
          type: string
        }
        Insert: {
          app: string
          description?: string
          fields?: Json
          fields_fn?: string | null
          kind: string
          label: string
          params_schema?: Json
          provides?: string[]
          scan_fn?: string | null
          sort?: number
          type: string
        }
        Update: {
          app?: string
          description?: string
          fields?: Json
          fields_fn?: string | null
          kind?: string
          label?: string
          params_schema?: Json
          provides?: string[]
          scan_fn?: string | null
          sort?: number
          type?: string
        }
        Relationships: []
      }
      automation_workflows: {
        Row: {
          adopted_from: string | null
          created_at: string
          created_by: string | null
          definition: Json | null
          description: string
          enabled: boolean
          id: string
          name: string
          org_id: string
          shared: boolean
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          adopted_from?: string | null
          created_at?: string
          created_by?: string | null
          definition?: Json | null
          description?: string
          enabled?: boolean
          id?: string
          name: string
          org_id: string
          shared?: boolean
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          adopted_from?: string | null
          created_at?: string
          created_by?: string | null
          definition?: Json | null
          description?: string
          enabled?: boolean
          id?: string
          name?: string
          org_id?: string
          shared?: boolean
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "automation_workflows_adopted_from_fkey"
            columns: ["adopted_from"]
            isOneToOne: false
            referencedRelation: "automation_workflows"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "automation_workflows_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      automations: {
        Row: {
          enabled: boolean
          kind: string
          org_id: string
          params: Json
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          enabled: boolean
          kind: string
          org_id: string
          params?: Json
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          enabled?: boolean
          kind?: string
          org_id?: string
          params?: Json
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "automations_kind_fkey"
            columns: ["kind"]
            isOneToOne: false
            referencedRelation: "automation_kinds"
            referencedColumns: ["key"]
          },
          {
            foreignKeyName: "automations_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      email_jobs: {
        Row: {
          every: unknown
          fn: string
          last_error: string | null
          last_run_at: string | null
          name: string
        }
        Insert: {
          every?: unknown
          fn: string
          last_error?: string | null
          last_run_at?: string | null
          name: string
        }
        Update: {
          every?: unknown
          fn?: string
          last_error?: string | null
          last_run_at?: string | null
          name?: string
        }
        Relationships: []
      }
      email_outbox: {
        Row: {
          app: string
          attempts: number
          category: string
          claimed_at: string | null
          created_at: string
          data: Json
          dedupe_key: string | null
          id: string
          last_error: string | null
          org_id: string | null
          provider_id: string | null
          send_after: string
          sent_at: string | null
          status: string
          template: string
          to_email: string | null
          to_user_id: string | null
        }
        Insert: {
          app: string
          attempts?: number
          category?: string
          claimed_at?: string | null
          created_at?: string
          data?: Json
          dedupe_key?: string | null
          id?: string
          last_error?: string | null
          org_id?: string | null
          provider_id?: string | null
          send_after?: string
          sent_at?: string | null
          status?: string
          template: string
          to_email?: string | null
          to_user_id?: string | null
        }
        Update: {
          app?: string
          attempts?: number
          category?: string
          claimed_at?: string | null
          created_at?: string
          data?: Json
          dedupe_key?: string | null
          id?: string
          last_error?: string | null
          org_id?: string | null
          provider_id?: string | null
          send_after?: string
          sent_at?: string | null
          status?: string
          template?: string
          to_email?: string | null
          to_user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "email_outbox_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      email_preferences: {
        Row: {
          digest: string
          digest_day: number
          digest_hour: number
          digest_include: string[]
          digest_last_sent_at: string | null
          digest_org_ids: string[] | null
          digest_time_zone: string | null
          reminders: boolean
          updated_at: string
          user_id: string
        }
        Insert: {
          digest?: string
          digest_day?: number
          digest_hour?: number
          digest_include?: string[]
          digest_last_sent_at?: string | null
          digest_org_ids?: string[] | null
          digest_time_zone?: string | null
          reminders?: boolean
          updated_at?: string
          user_id: string
        }
        Update: {
          digest?: string
          digest_day?: number
          digest_hour?: number
          digest_include?: string[]
          digest_last_sent_at?: string | null
          digest_org_ids?: string[] | null
          digest_time_zone?: string | null
          reminders?: boolean
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      instance_email_settings: {
        Row: {
          from_address: string | null
          from_name: string | null
          id: boolean
          reply_to: string | null
          smtp_host: string | null
          smtp_password_enc: string | null
          smtp_port: number | null
          smtp_security: string
          smtp_username: string | null
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          from_address?: string | null
          from_name?: string | null
          id?: boolean
          reply_to?: string | null
          smtp_host?: string | null
          smtp_password_enc?: string | null
          smtp_port?: number | null
          smtp_security?: string
          smtp_username?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          from_address?: string | null
          from_name?: string | null
          id?: boolean
          reply_to?: string | null
          smtp_host?: string | null
          smtp_password_enc?: string | null
          smtp_port?: number | null
          smtp_security?: string
          smtp_username?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      instance_settings: {
        Row: {
          billing_enabled: boolean
          hub_url: string | null
          id: boolean
        }
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
          app_payload: Json
          app_roles: Json
          created_at: string
          email: string | null
          expires_at: string
          id: string
          invited_by: string | null
          named_role_id: string | null
          org_id: string
          revoked_at: string | null
          role: Database["public"]["Enums"]["org_role"] | null
          token_hash: string
        }
        Insert: {
          accepted_at?: string | null
          accepted_by?: string | null
          app?: string | null
          app_payload?: Json
          app_roles?: Json
          created_at?: string
          email?: string | null
          expires_at: string
          id?: string
          invited_by?: string | null
          named_role_id?: string | null
          org_id: string
          revoked_at?: string | null
          role?: Database["public"]["Enums"]["org_role"] | null
          token_hash: string
        }
        Update: {
          accepted_at?: string | null
          accepted_by?: string | null
          app?: string | null
          app_payload?: Json
          app_roles?: Json
          created_at?: string
          email?: string | null
          expires_at?: string
          id?: string
          invited_by?: string | null
          named_role_id?: string | null
          org_id?: string
          revoked_at?: string | null
          role?: Database["public"]["Enums"]["org_role"] | null
          token_hash?: string
        }
        Relationships: [
          {
            foreignKeyName: "invitations_named_role_id_fkey"
            columns: ["named_role_id"]
            isOneToOne: false
            referencedRelation: "org_named_roles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invitations_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      memberships: {
        Row: {
          created_at: string
          named_role_id: string | null
          org_id: string
          role: Database["public"]["Enums"]["org_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          named_role_id?: string | null
          org_id: string
          role?: Database["public"]["Enums"]["org_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          named_role_id?: string | null
          org_id?: string
          role?: Database["public"]["Enums"]["org_role"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "memberships_named_role_fk"
            columns: ["org_id", "named_role_id"]
            isOneToOne: false
            referencedRelation: "org_named_roles"
            referencedColumns: ["org_id", "id"]
          },
          {
            foreignKeyName: "memberships_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      org_named_roles: {
        Row: {
          app_roles: Json
          created_at: string
          description: string
          id: string
          name: string
          org_id: string
          permissions: Json
          updated_at: string
        }
        Insert: {
          app_roles?: Json
          created_at?: string
          description?: string
          id?: string
          name: string
          org_id: string
          permissions?: Json
          updated_at?: string
        }
        Update: {
          app_roles?: Json
          created_at?: string
          description?: string
          id?: string
          name?: string
          org_id?: string
          permissions?: Json
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "org_named_roles_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
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
          parent_org_id: string | null
          slug: string | null
          source_app: string | null
          source_ref: string | null
          time_zone: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          currency?: string
          id?: string
          name: string
          parent_org_id?: string | null
          slug?: string | null
          source_app?: string | null
          source_ref?: string | null
          time_zone?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          currency?: string
          id?: string
          name?: string
          parent_org_id?: string | null
          slug?: string | null
          source_app?: string | null
          source_ref?: string | null
          time_zone?: string
        }
        Relationships: [
          {
            foreignKeyName: "organizations_parent_org_id_fkey"
            columns: ["parent_org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          display_name: string | null
          id: string
          updated_at: string
        }
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
      _automation_condition: {
        Args: { p_c: Json; p_ctx: Json }
        Returns: boolean
      }
      _automation_execute: {
        Args: {
          p_ctx: Json
          p_dedupe: string
          p_def: Json
          p_org: string
          p_wf: Database["public"]["Tables"]["automation_workflows"]["Row"]
        }
        Returns: number
      }
      _automation_extra_fields: {
        Args: { p_fn: string; p_org: string }
        Returns: Json
      }
      _automation_fill: {
        Args: { p_ctx: Json; p_text: string }
        Returns: string
      }
      _automation_recipients: {
        Args: { p_ctx: Json; p_org: string; p_to: Json }
        Returns: {
          email: string
          user_id: string
        }[]
      }
      _clean_app_permissions: { Args: { p_value: Json }; Returns: Json }
      _clean_app_roles: { Args: { p_value: Json }; Returns: Json }
      _clean_automation_params: {
        Args: { p_params: Json; p_schema: Json }
        Returns: Json
      }
      _clean_org_name: { Args: { p_name: string }; Returns: string }
      _create_child_organization: {
        Args: {
          p_admins?: string[]
          p_name: string
          p_owner: string
          p_parent: string
          p_source_app: string
          p_source_ref: string
        }
        Returns: string
      }
      _email_opted_out: {
        Args: { p_category: string; p_user: string }
        Returns: boolean
      }
      _is_active_user: { Args: { p_user: string }; Returns: boolean }
      _may_build_workflows: { Args: { p_org: string }; Returns: boolean }
      _member_confirm_text: { Args: { p_user: string }; Returns: string }
      _require_people_manager: { Args: { p_org: string }; Returns: undefined }
      _require_uid: { Args: never; Returns: string }
      _token_hash: { Args: { p_token: string }; Returns: string }
      _validate_actions: {
        Args: {
          p_actions: Json
          p_trig: Database["public"]["Tables"]["automation_trigger_types"]["Row"]
          p_where: string
        }
        Returns: Json
      }
      _validate_recipient: { Args: { p: Json; p_where: string }; Returns: Json }
      _validate_workflow: { Args: { p_def: Json }; Returns: Json }
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
      adopt_workflow: {
        Args: { p_org: string; p_source: string }
        Returns: string
      }
      app_role: {
        Args: { p_app: string; p_org: string; p_user?: string }
        Returns: Database["public"]["Enums"]["org_role"]
      }
      app_role_source: {
        Args: { p_app: string; p_org: string; p_user?: string }
        Returns: string
      }
      automation_settings: {
        Args: { p_kind: string; p_org: string }
        Returns: {
          enabled: boolean
          params: Json
        }[]
      }
      can_edit_automations: { Args: { p_org: string }; Returns: boolean }
      can_write: { Args: { p_app: string; p_org: string }; Returns: boolean }
      claim_automation_jobs: {
        Args: { p_app: string; p_limit?: number }
        Returns: {
          app: string
          attempts: number
          created_at: string
          error: string | null
          id: number
          kind: string
          org_id: string
          payload: Json
          result: Json | null
          run_id: number | null
          status: string
          updated_at: string
        }[]
        SetofOptions: {
          from: "*"
          to: "automation_jobs"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      claim_emails: {
        Args: { p_apps?: string[]; p_limit?: number }
        Returns: {
          app: string
          attempts: number
          category: string
          data: Json
          id: string
          org_id: string
          org_name: string
          org_time_zone: string
          template: string
          to_email: string
          to_name: string
          to_user_id: string
        }[]
      }
      complete_automation_task: { Args: { p_id: string }; Returns: undefined }
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
      delete_named_role: {
        Args: { p_id: string; p_org: string }
        Returns: undefined
      }
      delete_organization: {
        Args: { p_confirm_name: string; p_org: string }
        Returns: undefined
      }
      delete_workflow: { Args: { p_id: string }; Returns: undefined }
      digest_automation_tasks: {
        Args: { p_org: string; p_user: string }
        Returns: Json
      }
      digest_for: { Args: { p_period?: string; p_user: string }; Returns: Json }
      email_unsubscribe: {
        Args: { p_category: string; p_user: string }
        Returns: undefined
      }
      emit_automation_event: {
        Args: { p_ctx: Json; p_org: string; p_type: string }
        Returns: undefined
      }
      enqueue_email: {
        Args: {
          p_app: string
          p_category?: string
          p_data?: Json
          p_dedupe_key?: string
          p_org?: string
          p_send_after?: string
          p_template: string
          p_to_email?: string
          p_to_user?: string
        }
        Returns: string
      }
      finish_automation_job: {
        Args: { p_error: string; p_id: number; p_ok: boolean; p_result: Json }
        Returns: undefined
      }
      finish_email: {
        Args: {
          p_error?: string
          p_id: string
          p_outcome: string
          p_provider_id?: string
        }
        Returns: undefined
      }
      get_digest_preferences: {
        Args: never
        Returns: {
          digest: string
          digest_day: number
          digest_hour: number
          digest_include: string[]
          digest_org_ids: string[]
          digest_time_zone: string
        }[]
      }
      get_email_preferences: {
        Args: never
        Returns: {
          digest: string
          reminders: boolean
        }[]
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
      grant_automation_editor: {
        Args: { p_grant: boolean; p_org: string; p_user: string }
        Returns: undefined
      }
      has_app_access: {
        Args: { p_app: string; p_org: string }
        Returns: boolean
      }
      has_app_permission: {
        Args: { p_app: string; p_key: string; p_org: string; p_user?: string }
        Returns: boolean
      }
      has_app_role: {
        Args: {
          p_app: string
          p_org: string
          p_roles: Database["public"]["Enums"]["org_role"][]
        }
        Returns: boolean
      }
      has_role: {
        Args: {
          p_org: string
          p_roles: Database["public"]["Enums"]["org_role"][]
        }
        Returns: boolean
      }
      is_instance_owner: { Args: never; Returns: boolean }
      is_member: { Args: { p_org: string }; Returns: boolean }
      is_member_of_child: { Args: { p_org: string }; Returns: boolean }
      is_org_editor: {
        Args: { p_org: string; p_user: string }
        Returns: boolean
      }
      list_automations: {
        Args: { p_org: string }
        Returns: {
          app: string
          category: string
          default_enabled: boolean
          default_params: Json
          description: string
          enabled: boolean
          is_default: boolean
          kind: string
          last_run_at: string
          last_summary: string
          name: string
          params: Json
          params_schema: Json
          updated_at: string
        }[]
      }
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
      log_automation: {
        Args: {
          p_count: number
          p_kind: string
          p_org: string
          p_summary: string
        }
        Returns: undefined
      }
      my_app_memberships: {
        Args: { p_app: string }
        Returns: {
          org_id: string
          role: Database["public"]["Enums"]["org_role"]
        }[]
      }
      org_app_roles: {
        Args: { p_org: string }
        Returns: {
          app: string
          named_role: string
          named_role_id: string
          role: Database["public"]["Enums"]["org_role"]
          source: string
          user_id: string
        }[]
      }
      org_editor_count: { Args: { p_org: string }; Returns: number }
      org_email_log: {
        Args: { p_limit?: number; p_org: string }
        Returns: {
          app: string
          attempts: number
          category: string
          created_at: string
          id: string
          last_error: string
          sent_at: string
          status: string
          template: string
          to_email: string
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
      prune_automation_log: { Args: never; Returns: number }
      prune_workflow_history: { Args: never; Returns: number }
      queue_digests: { Args: never; Returns: number }
      register_app_permission: {
        Args: {
          p_app: string
          p_description?: string
          p_key: string
          p_label: string
          p_sort?: number
        }
        Returns: undefined
      }
      register_automation_action: {
        Args: {
          p_app: string
          p_description: string
          p_label: string
          p_params_schema: Json
          p_requires: string[]
          p_sort?: number
          p_type: string
        }
        Returns: undefined
      }
      register_automation_kind: {
        Args: {
          p_app: string
          p_category: string
          p_default_enabled: boolean
          p_default_params: Json
          p_description: string
          p_key: string
          p_name: string
          p_params_schema: Json
          p_sort?: number
        }
        Returns: undefined
      }
      register_automation_recipient: {
        Args: {
          p_app: string
          p_description: string
          p_label: string
          p_options_fn?: string
          p_params_schema: Json
          p_resolve_fn: string
          p_sort?: number
          p_type: string
        }
        Returns: undefined
      }
      register_automation_trigger: {
        Args: {
          p_app: string
          p_description: string
          p_fields: Json
          p_fields_fn: string
          p_kind: string
          p_label: string
          p_params_schema: Json
          p_provides: string[]
          p_scan_fn: string
          p_sort?: number
          p_type: string
        }
        Returns: undefined
      }
      rename_organization: {
        Args: { p_name: string; p_org: string }
        Returns: undefined
      }
      reset_automation: {
        Args: { p_kind: string; p_org: string }
        Returns: undefined
      }
      revoke_invitation: { Args: { p_id: string }; Returns: undefined }
      run_email_jobs: { Args: never; Returns: number }
      run_workflows: { Args: never; Returns: number }
      save_named_role: {
        Args: {
          p_app_roles: Json
          p_description: string
          p_id: string
          p_name: string
          p_org: string
          p_permissions: Json
        }
        Returns: string
      }
      save_workflow: {
        Args: {
          p_definition: Json
          p_description: string
          p_enabled: boolean
          p_id: string
          p_name: string
          p_org: string
          p_shared?: boolean
        }
        Returns: string
      }
      set_app_role: {
        Args: {
          p_app: string
          p_org: string
          p_role: Database["public"]["Enums"]["org_role"]
          p_user: string
        }
        Returns: undefined
      }
      set_automation: {
        Args: {
          p_enabled: boolean
          p_kind: string
          p_org: string
          p_params: Json
        }
        Returns: undefined
      }
      set_chapters_may_build: {
        Args: { p_allowed: boolean; p_org: string }
        Returns: undefined
      }
      set_digest_preferences: {
        Args: {
          p_day: number
          p_digest: string
          p_hour: number
          p_include: string[]
          p_org_ids: string[]
          p_time_zone: string
        }
        Returns: undefined
      }
      set_email_preferences: {
        Args: { p_digest: string; p_reminders: boolean }
        Returns: undefined
      }
      set_invitation_roles: {
        Args: { p_app_roles: Json; p_invitation: string; p_named_role: string }
        Returns: undefined
      }
      set_named_role: {
        Args: { p_org: string; p_role: string; p_user: string }
        Returns: undefined
      }
      set_organization_preferences: {
        Args: { p_currency: string; p_org: string; p_time_zone: string }
        Returns: undefined
      }
      set_workflow_enabled: {
        Args: { p_enabled: boolean; p_id: string }
        Returns: undefined
      }
      shares_org: { Args: { p_user: string }; Returns: boolean }
      transfer_ownership:
        | { Args: { p_new_owner: string; p_org: string }; Returns: undefined }
        | {
            Args: { p_confirm: string; p_new_owner: string; p_org: string }
            Returns: undefined
          }
      workflow_overview: { Args: { p_org: string }; Returns: Json }
      workflow_runs: {
        Args: { p_limit?: number; p_org: string; p_workflow?: string }
        Returns: {
          branch: string
          error: string
          id: number
          log: Json
          started_at: string
          status: string
          summary: string
          trigger_type: string
          workflow_id: string
          workflow_name: string
        }[]
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


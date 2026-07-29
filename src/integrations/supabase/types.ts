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
    PostgrestVersion: "14.4"
  }
  public: {
    Tables: {
      admin_welcome_seen: {
        Row: {
          seen_at: string
          user_id: string
        }
        Insert: {
          seen_at?: string
          user_id: string
        }
        Update: {
          seen_at?: string
          user_id?: string
        }
        Relationships: []
      }
      ai_price_memory: {
        Row: {
          contacts_count: number
          created_at: string
          ctr: number | null
          days_to_sell: number | null
          gallery_score: number | null
          id: string
          listed_price: number | null
          make: string
          metadata: Json
          mileage: number | null
          model: string
          showroom_mode: boolean
          sold_at: string | null
          sold_price: number | null
          vehicle_id: string | null
          vin: string
          year: number | null
        }
        Insert: {
          contacts_count?: number
          created_at?: string
          ctr?: number | null
          days_to_sell?: number | null
          gallery_score?: number | null
          id?: string
          listed_price?: number | null
          make?: string
          metadata?: Json
          mileage?: number | null
          model?: string
          showroom_mode?: boolean
          sold_at?: string | null
          sold_price?: number | null
          vehicle_id?: string | null
          vin?: string
          year?: number | null
        }
        Update: {
          contacts_count?: number
          created_at?: string
          ctr?: number | null
          days_to_sell?: number | null
          gallery_score?: number | null
          id?: string
          listed_price?: number | null
          make?: string
          metadata?: Json
          mileage?: number | null
          model?: string
          showroom_mode?: boolean
          sold_at?: string | null
          sold_price?: number | null
          vehicle_id?: string | null
          vin?: string
          year?: number | null
        }
        Relationships: []
      }
      ai_price_suggestions: {
        Row: {
          confidence: number
          created_at: string
          id: string
          input_snapshot: Json
          market_avg: number | null
          market_high: number | null
          market_low: number | null
          reasons_down: Json
          reasons_up: Json
          recommended: number | null
          sell_speed: string
          sources: Json
          vehicle_id: string | null
          vin: string
        }
        Insert: {
          confidence?: number
          created_at?: string
          id?: string
          input_snapshot?: Json
          market_avg?: number | null
          market_high?: number | null
          market_low?: number | null
          reasons_down?: Json
          reasons_up?: Json
          recommended?: number | null
          sell_speed?: string
          sources?: Json
          vehicle_id?: string | null
          vin?: string
        }
        Update: {
          confidence?: number
          created_at?: string
          id?: string
          input_snapshot?: Json
          market_avg?: number | null
          market_high?: number | null
          market_low?: number | null
          reasons_down?: Json
          reasons_up?: Json
          recommended?: number | null
          sell_speed?: string
          sources?: Json
          vehicle_id?: string | null
          vin?: string
        }
        Relationships: []
      }
      api_cache: {
        Row: {
          cache_key: string
          cache_type: string
          created_at: string
          data: Json
          id: string
          ttl_seconds: number | null
        }
        Insert: {
          cache_key?: string
          cache_type?: string
          created_at?: string
          data?: Json
          id?: string
          ttl_seconds?: number | null
        }
        Update: {
          cache_key?: string
          cache_type?: string
          created_at?: string
          data?: Json
          id?: string
          ttl_seconds?: number | null
        }
        Relationships: []
      }
      export_logs: {
        Row: {
          context: Json
          created_at: string
          id: string
          level: string
          message: string
          operation: string
          portal: Database["public"]["Enums"]["export_portal"] | null
          vehicle_id: string | null
        }
        Insert: {
          context?: Json
          created_at?: string
          id?: string
          level?: string
          message?: string
          operation?: string
          portal?: Database["public"]["Enums"]["export_portal"] | null
          vehicle_id?: string | null
        }
        Update: {
          context?: Json
          created_at?: string
          id?: string
          level?: string
          message?: string
          operation?: string
          portal?: Database["public"]["Enums"]["export_portal"] | null
          vehicle_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "export_logs_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicles"
            referencedColumns: ["id"]
          },
        ]
      }
      facility_photos: {
        Row: {
          alt_text: string
          caption: string
          created_at: string
          id: string
          image_url: string
          sort_order: number
        }
        Insert: {
          alt_text?: string
          caption?: string
          created_at?: string
          id?: string
          image_url: string
          sort_order?: number
        }
        Update: {
          alt_text?: string
          caption?: string
          created_at?: string
          id?: string
          image_url?: string
          sort_order?: number
        }
        Relationships: []
      }
      leads: {
        Row: {
          created_at: string
          email: string
          id: string
          message: string
          metadata: Json | null
          name: string
          phone: string
          type: string
          vehicle_model: string
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          message?: string
          metadata?: Json | null
          name: string
          phone?: string
          type: string
          vehicle_model?: string
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          message?: string
          metadata?: Json | null
          name?: string
          phone?: string
          type?: string
          vehicle_model?: string
        }
        Relationships: []
      }
      marketing_banners: {
        Row: {
          click_count: number
          content_data: Json
          content_type: string
          created_at: string
          cta_text: string
          end_date: string | null
          headline: string
          id: string
          impression_count: number
          is_active: boolean
          layout_variant: string
          link_config: Json
          link_url: string
          media_url: string
          name: string
          position_matrix: Json
          show_desktop: boolean
          show_mobile: boolean
          show_tablet: boolean
          sort_order: number
          start_date: string | null
          style_preset: string
          styles: Json
          subheadline: string
          target_page: string
          target_position: string
          updated_at: string
        }
        Insert: {
          click_count?: number
          content_data?: Json
          content_type?: string
          created_at?: string
          cta_text?: string
          end_date?: string | null
          headline?: string
          id?: string
          impression_count?: number
          is_active?: boolean
          layout_variant?: string
          link_config?: Json
          link_url?: string
          media_url?: string
          name: string
          position_matrix?: Json
          show_desktop?: boolean
          show_mobile?: boolean
          show_tablet?: boolean
          sort_order?: number
          start_date?: string | null
          style_preset?: string
          styles?: Json
          subheadline?: string
          target_page?: string
          target_position?: string
          updated_at?: string
        }
        Update: {
          click_count?: number
          content_data?: Json
          content_type?: string
          created_at?: string
          cta_text?: string
          end_date?: string | null
          headline?: string
          id?: string
          impression_count?: number
          is_active?: boolean
          layout_variant?: string
          link_config?: Json
          link_url?: string
          media_url?: string
          name?: string
          position_matrix?: Json
          show_desktop?: boolean
          show_mobile?: boolean
          show_tablet?: boolean
          sort_order?: number
          start_date?: string | null
          style_preset?: string
          styles?: Json
          subheadline?: string
          target_page?: string
          target_position?: string
          updated_at?: string
        }
        Relationships: []
      }
      page_views: {
        Row: {
          created_at: string
          entry_referrer: string | null
          exit_page: boolean | null
          id: string
          is_bounce: boolean | null
          path: string
          referrer: string | null
          screen_height: number | null
          screen_width: number | null
          session_id: string
          time_on_page: number | null
          utm_campaign: string | null
          utm_medium: string | null
          utm_source: string | null
        }
        Insert: {
          created_at?: string
          entry_referrer?: string | null
          exit_page?: boolean | null
          id?: string
          is_bounce?: boolean | null
          path: string
          referrer?: string | null
          screen_height?: number | null
          screen_width?: number | null
          session_id: string
          time_on_page?: number | null
          utm_campaign?: string | null
          utm_medium?: string | null
          utm_source?: string | null
        }
        Update: {
          created_at?: string
          entry_referrer?: string | null
          exit_page?: boolean | null
          id?: string
          is_bounce?: boolean | null
          path?: string
          referrer?: string | null
          screen_height?: number | null
          screen_width?: number | null
          session_id?: string
          time_on_page?: number | null
          utm_campaign?: string | null
          utm_medium?: string | null
          utm_source?: string | null
        }
        Relationships: []
      }
      scrape_log: {
        Row: {
          error_message: string | null
          finished_at: string | null
          id: string
          images_downloaded: number | null
          started_at: string
          status: string
          triggered_by: string | null
          vehicles_found: number | null
          vehicles_updated: number | null
        }
        Insert: {
          error_message?: string | null
          finished_at?: string | null
          id?: string
          images_downloaded?: number | null
          started_at?: string
          status?: string
          triggered_by?: string | null
          vehicles_found?: number | null
          vehicles_updated?: number | null
        }
        Update: {
          error_message?: string | null
          finished_at?: string | null
          id?: string
          images_downloaded?: number | null
          started_at?: string
          status?: string
          triggered_by?: string | null
          vehicles_found?: number | null
          vehicles_updated?: number | null
        }
        Relationships: []
      }
      site_contacts: {
        Row: {
          id: string
          key: string
          updated_at: string
          value: string
        }
        Insert: {
          id?: string
          key: string
          updated_at?: string
          value?: string
        }
        Update: {
          id?: string
          key?: string
          updated_at?: string
          value?: string
        }
        Relationships: []
      }
      smart_capture_photos: {
        Row: {
          ai_classification: Json
          created_at: string
          height: number | null
          id: string
          is_main: boolean
          original_url: string
          processed_url: string
          quality: Json
          quality_score: number
          session_id: string
          shot_index: number
          shot_type: string
          width: number | null
        }
        Insert: {
          ai_classification?: Json
          created_at?: string
          height?: number | null
          id?: string
          is_main?: boolean
          original_url?: string
          processed_url?: string
          quality?: Json
          quality_score?: number
          session_id: string
          shot_index?: number
          shot_type?: string
          width?: number | null
        }
        Update: {
          ai_classification?: Json
          created_at?: string
          height?: number | null
          id?: string
          is_main?: boolean
          original_url?: string
          processed_url?: string
          quality?: Json
          quality_score?: number
          session_id?: string
          shot_index?: number
          shot_type?: string
          width?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "smart_capture_photos_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "smart_capture_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      smart_capture_sessions: {
        Row: {
          created_at: string
          decoded_data: Json
          has_360: boolean
          id: string
          metadata: Json
          published_vehicle_id: string | null
          quality_score: number
          status: string
          updated_at: string
          user_id: string
          vin: string
        }
        Insert: {
          created_at?: string
          decoded_data?: Json
          has_360?: boolean
          id?: string
          metadata?: Json
          published_vehicle_id?: string | null
          quality_score?: number
          status?: string
          updated_at?: string
          user_id: string
          vin?: string
        }
        Update: {
          created_at?: string
          decoded_data?: Json
          has_360?: boolean
          id?: string
          metadata?: Json
          published_vehicle_id?: string | null
          quality_score?: number
          status?: string
          updated_at?: string
          user_id?: string
          vin?: string
        }
        Relationships: []
      }
      smart_capture_settings: {
        Row: {
          ai_classify_shots: string
          ai_quality_check: string
          ai_realtime_hints: string
          assistance_level: string
          auto_360_generation: string
          auto_brightness_normalize: string
          auto_crop: string
          auto_exposure_correction: string
          auto_image_processing: string
          auto_naming: string
          auto_pick_main: string
          auto_sort_gallery: string
          background_video_capture: string
          blur_detection: string
          blur_license_plate: string
          export_folders: string
          generate_listing_versions: string
          generate_web_versions: string
          grid_overlay: string
          horizon_auto_level: string
          id: string
          landscape_capture: string
          quality_score_enabled: string
          safe_mode: boolean
          singleton: boolean
          updated_at: string
          vin_autofill: string
          vin_ocr: string
          vin_scan_enabled: string
          voice_control: string
          watermark: string
        }
        Insert: {
          ai_classify_shots?: string
          ai_quality_check?: string
          ai_realtime_hints?: string
          assistance_level?: string
          auto_360_generation?: string
          auto_brightness_normalize?: string
          auto_crop?: string
          auto_exposure_correction?: string
          auto_image_processing?: string
          auto_naming?: string
          auto_pick_main?: string
          auto_sort_gallery?: string
          background_video_capture?: string
          blur_detection?: string
          blur_license_plate?: string
          export_folders?: string
          generate_listing_versions?: string
          generate_web_versions?: string
          grid_overlay?: string
          horizon_auto_level?: string
          id?: string
          landscape_capture?: string
          quality_score_enabled?: string
          safe_mode?: boolean
          singleton?: boolean
          updated_at?: string
          vin_autofill?: string
          vin_ocr?: string
          vin_scan_enabled?: string
          voice_control?: string
          watermark?: string
        }
        Update: {
          ai_classify_shots?: string
          ai_quality_check?: string
          ai_realtime_hints?: string
          assistance_level?: string
          auto_360_generation?: string
          auto_brightness_normalize?: string
          auto_crop?: string
          auto_exposure_correction?: string
          auto_image_processing?: string
          auto_naming?: string
          auto_pick_main?: string
          auto_sort_gallery?: string
          background_video_capture?: string
          blur_detection?: string
          blur_license_plate?: string
          export_folders?: string
          generate_listing_versions?: string
          generate_web_versions?: string
          grid_overlay?: string
          horizon_auto_level?: string
          id?: string
          landscape_capture?: string
          quality_score_enabled?: string
          safe_mode?: boolean
          singleton?: boolean
          updated_at?: string
          vin_autofill?: string
          vin_ocr?: string
          vin_scan_enabled?: string
          voice_control?: string
          watermark?: string
        }
        Relationships: []
      }
      ticker_items: {
        Row: {
          created_at: string
          id: string
          is_active: boolean
          sort_order: number
          text: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_active?: boolean
          sort_order?: number
          text: string
        }
        Update: {
          created_at?: string
          id?: string
          is_active?: boolean
          sort_order?: number
          text?: string
        }
        Relationships: []
      }
      tipcars_settings: {
        Row: {
          auto_export_enabled: boolean
          created_at: string
          cron_schedule: string
          cron_timezone: string
          firma_email: string | null
          firma_mesto: string | null
          firma_nazev: string
          firma_psc: string | null
          firma_telefon: string | null
          firma_ulice: string | null
          firma_www: string | null
          heslo: string
          id: string
          kod_firmy: string
          last_auto_run_at: string | null
          live_heslo: string
          live_kod_firmy: string
          live_sftp_host: string
          live_sftp_password: string
          live_sftp_port: number
          live_sftp_user: string
          sftp_host: string
          sftp_password: string
          sftp_port: number
          sftp_user: string
          test_mode: boolean
          test_mode_locked: boolean
          updated_at: string
        }
        Insert: {
          auto_export_enabled?: boolean
          created_at?: string
          cron_schedule?: string
          cron_timezone?: string
          firma_email?: string | null
          firma_mesto?: string | null
          firma_nazev?: string
          firma_psc?: string | null
          firma_telefon?: string | null
          firma_ulice?: string | null
          firma_www?: string | null
          heslo?: string
          id?: string
          kod_firmy?: string
          last_auto_run_at?: string | null
          live_heslo?: string
          live_kod_firmy?: string
          live_sftp_host?: string
          live_sftp_password?: string
          live_sftp_port?: number
          live_sftp_user?: string
          sftp_host?: string
          sftp_password?: string
          sftp_port?: number
          sftp_user?: string
          test_mode?: boolean
          test_mode_locked?: boolean
          updated_at?: string
        }
        Update: {
          auto_export_enabled?: boolean
          created_at?: string
          cron_schedule?: string
          cron_timezone?: string
          firma_email?: string | null
          firma_mesto?: string | null
          firma_nazev?: string
          firma_psc?: string | null
          firma_telefon?: string | null
          firma_ulice?: string | null
          firma_www?: string | null
          heslo?: string
          id?: string
          kod_firmy?: string
          last_auto_run_at?: string | null
          live_heslo?: string
          live_kod_firmy?: string
          live_sftp_host?: string
          live_sftp_password?: string
          live_sftp_port?: number
          live_sftp_user?: string
          sftp_host?: string
          sftp_password?: string
          sftp_port?: number
          sftp_user?: string
          test_mode?: boolean
          test_mode_locked?: boolean
          updated_at?: string
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
      vehicle_exports: {
        Row: {
          attempts: number
          created_at: string
          external_id: string
          id: string
          last_error: string
          last_export_at: string | null
          last_success_at: string | null
          metadata: Json
          payload_hash: string
          portal: Database["public"]["Enums"]["export_portal"]
          status: Database["public"]["Enums"]["export_status"]
          updated_at: string
          vehicle_id: string
        }
        Insert: {
          attempts?: number
          created_at?: string
          external_id?: string
          id?: string
          last_error?: string
          last_export_at?: string | null
          last_success_at?: string | null
          metadata?: Json
          payload_hash?: string
          portal: Database["public"]["Enums"]["export_portal"]
          status?: Database["public"]["Enums"]["export_status"]
          updated_at?: string
          vehicle_id: string
        }
        Update: {
          attempts?: number
          created_at?: string
          external_id?: string
          id?: string
          last_error?: string
          last_export_at?: string | null
          last_success_at?: string | null
          metadata?: Json
          payload_hash?: string
          portal?: Database["public"]["Enums"]["export_portal"]
          status?: Database["public"]["Enums"]["export_status"]
          updated_at?: string
          vehicle_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "vehicle_exports_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicles"
            referencedColumns: ["id"]
          },
        ]
      }
      vehicle_images: {
        Row: {
          created_at: string
          id: string
          image_url: string
          is_main: boolean
          original_backup_url: string
          showroom_applied_at: string | null
          showroom_error: string
          showroom_generated_at: string | null
          showroom_history: Json
          showroom_progress: number
          showroom_status: string
          showroom_thumb_url: string
          showroom_url: string
          sort_order: number
          vehicle_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          image_url: string
          is_main?: boolean
          original_backup_url?: string
          showroom_applied_at?: string | null
          showroom_error?: string
          showroom_generated_at?: string | null
          showroom_history?: Json
          showroom_progress?: number
          showroom_status?: string
          showroom_thumb_url?: string
          showroom_url?: string
          sort_order?: number
          vehicle_id: string
        }
        Update: {
          created_at?: string
          id?: string
          image_url?: string
          is_main?: boolean
          original_backup_url?: string
          showroom_applied_at?: string | null
          showroom_error?: string
          showroom_generated_at?: string | null
          showroom_history?: Json
          showroom_progress?: number
          showroom_status?: string
          showroom_thumb_url?: string
          showroom_url?: string
          sort_order?: number
          vehicle_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "vehicle_images_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicles"
            referencedColumns: ["id"]
          },
        ]
      }
      vehicles: {
        Row: {
          carfax_enabled: boolean
          carfax_url: string
          color: string
          created_at: string
          description: string
          engine: string
          fuel: string
          id: string
          image_url: string
          inventory_number: string
          lpg_description: string
          lpg_enabled: boolean
          mileage: number
          name: string
          power: string
          price_with_vat: number
          show_vat: boolean
          showroom_mode: string
          status: Database["public"]["Enums"]["vehicle_status"]
          tipcars_airbagy: number | null
          tipcars_emisni_norma: string | null
          tipcars_export_enabled: boolean | null
          tipcars_garantovany_najezd: boolean | null
          tipcars_karoserie_kod: string | null
          tipcars_karoserie_popis: string | null
          tipcars_klimatizace: string | null
          tipcars_model_kod: string | null
          tipcars_nebourane: boolean | null
          tipcars_pocet_dveri: number | null
          tipcars_pocet_mist: number | null
          tipcars_pohon: string | null
          tipcars_prevodovka_pocet: number | null
          tipcars_prvni_majitel: boolean | null
          tipcars_servisni_knizka: boolean | null
          tipcars_stk_do: string | null
          tipcars_znacka_kod: string | null
          transmission: string
          updated_at: string
          video_enabled: boolean
          video_id: string
          vin: string
          warranty_enabled: boolean
          year: number
        }
        Insert: {
          carfax_enabled?: boolean
          carfax_url?: string
          color?: string
          created_at?: string
          description?: string
          engine?: string
          fuel?: string
          id?: string
          image_url?: string
          inventory_number?: string
          lpg_description?: string
          lpg_enabled?: boolean
          mileage?: number
          name: string
          power?: string
          price_with_vat: number
          show_vat?: boolean
          showroom_mode?: string
          status?: Database["public"]["Enums"]["vehicle_status"]
          tipcars_airbagy?: number | null
          tipcars_emisni_norma?: string | null
          tipcars_export_enabled?: boolean | null
          tipcars_garantovany_najezd?: boolean | null
          tipcars_karoserie_kod?: string | null
          tipcars_karoserie_popis?: string | null
          tipcars_klimatizace?: string | null
          tipcars_model_kod?: string | null
          tipcars_nebourane?: boolean | null
          tipcars_pocet_dveri?: number | null
          tipcars_pocet_mist?: number | null
          tipcars_pohon?: string | null
          tipcars_prevodovka_pocet?: number | null
          tipcars_prvni_majitel?: boolean | null
          tipcars_servisni_knizka?: boolean | null
          tipcars_stk_do?: string | null
          tipcars_znacka_kod?: string | null
          transmission?: string
          updated_at?: string
          video_enabled?: boolean
          video_id?: string
          vin?: string
          warranty_enabled?: boolean
          year: number
        }
        Update: {
          carfax_enabled?: boolean
          carfax_url?: string
          color?: string
          created_at?: string
          description?: string
          engine?: string
          fuel?: string
          id?: string
          image_url?: string
          inventory_number?: string
          lpg_description?: string
          lpg_enabled?: boolean
          mileage?: number
          name?: string
          power?: string
          price_with_vat?: number
          show_vat?: boolean
          showroom_mode?: string
          status?: Database["public"]["Enums"]["vehicle_status"]
          tipcars_airbagy?: number | null
          tipcars_emisni_norma?: string | null
          tipcars_export_enabled?: boolean | null
          tipcars_garantovany_najezd?: boolean | null
          tipcars_karoserie_kod?: string | null
          tipcars_karoserie_popis?: string | null
          tipcars_klimatizace?: string | null
          tipcars_model_kod?: string | null
          tipcars_nebourane?: boolean | null
          tipcars_pocet_dveri?: number | null
          tipcars_pocet_mist?: number | null
          tipcars_pohon?: string | null
          tipcars_prevodovka_pocet?: number | null
          tipcars_prvni_majitel?: boolean | null
          tipcars_servisni_knizka?: boolean | null
          tipcars_stk_do?: string | null
          tipcars_znacka_kod?: string | null
          transmission?: string
          updated_at?: string
          video_enabled?: boolean
          video_id?: string
          vin?: string
          warranty_enabled?: boolean
          year?: number
        }
        Relationships: []
      }
      weekly_hit_songs: {
        Row: {
          created_at: string
          id: string
          is_special: boolean
          lyrics: string
          title: string
          vibe: string
          week_start: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_special?: boolean
          lyrics?: string
          title?: string
          vibe?: string
          week_start?: string
        }
        Update: {
          created_at?: string
          id?: string
          is_special?: boolean
          lyrics?: string
          title?: string
          vibe?: string
          week_start?: string
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
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      increment_banner_click: {
        Args: { _banner_id: string }
        Returns: undefined
      }
      increment_banner_impression: {
        Args: { _banner_id: string }
        Returns: undefined
      }
      set_tipcars_cron_schedule: {
        Args: { p_schedule: string }
        Returns: undefined
      }
    }
    Enums: {
      app_role: "admin" | "moderator" | "user"
      export_portal: "tipcars" | "sauto"
      export_status: "pending" | "online" | "error" | "removed" | "disabled"
      vehicle_status: "skladem" | "na-ceste" | "rezervovano" | "prodano"
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
      app_role: ["admin", "moderator", "user"],
      export_portal: ["tipcars", "sauto"],
      export_status: ["pending", "online", "error", "removed", "disabled"],
      vehicle_status: ["skladem", "na-ceste", "rezervovano", "prodano"],
    },
  },
} as const

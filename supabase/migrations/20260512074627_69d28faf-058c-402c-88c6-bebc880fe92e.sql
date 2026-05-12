
ALTER TABLE public.tipcars_settings
  ADD COLUMN IF NOT EXISTS live_kod_firmy text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS live_heslo text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS live_sftp_host text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS live_sftp_port integer NOT NULL DEFAULT 22,
  ADD COLUMN IF NOT EXISTS live_sftp_user text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS live_sftp_password text NOT NULL DEFAULT '';

CREATE TABLE IF NOT EXISTS app_settings (
    setting_key   TEXT PRIMARY KEY,
    setting_value TEXT NOT NULL DEFAULT '',
    updated_at    TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

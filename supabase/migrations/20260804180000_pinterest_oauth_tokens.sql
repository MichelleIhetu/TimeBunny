CREATE TABLE public.pinterest_oauth_tokens (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  refresh_token TEXT,
  access_token TEXT,
  expires_at TIMESTAMPTZ,
  scope TEXT,
  pinterest_username TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.pinterest_oauth_tokens TO authenticated;
GRANT ALL ON public.pinterest_oauth_tokens TO service_role;

ALTER TABLE public.pinterest_oauth_tokens ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own pinterest tokens"
  ON public.pinterest_oauth_tokens FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

REVOKE SELECT ON public.pinterest_oauth_tokens FROM anon;

CREATE TRIGGER trg_pinterest_oauth_tokens_updated
  BEFORE UPDATE ON public.pinterest_oauth_tokens
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

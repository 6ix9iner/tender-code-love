
-- app_users: deny all client access (service role bypasses RLS)
REVOKE ALL ON public.app_users FROM anon, authenticated;
GRANT ALL ON public.app_users TO service_role;

-- insights: user-scoped read only
GRANT SELECT ON public.insights TO authenticated;
GRANT ALL ON public.insights TO service_role;

CREATE POLICY insights_select ON public.insights
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

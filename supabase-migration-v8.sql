-- Add avatar_url to profiles
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS avatar_url TEXT;

-- Storage bucket for avatars (run this in Supabase dashboard > Storage, or via SQL)
-- The bucket needs to be created manually in the Supabase dashboard:
-- 1. Go to Storage > New bucket
-- 2. Name: "avatars"
-- 3. Public bucket: YES
-- 4. Add policy: authenticated users can upload/update their own files

INSERT INTO storage.buckets (id, name, public)
VALUES ('avatars', 'avatars', true)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Avatar upload" ON storage.objects
  FOR INSERT WITH CHECK (bucket_id = 'avatars' AND auth.role() = 'authenticated');

CREATE POLICY "Avatar update" ON storage.objects
  FOR UPDATE USING (bucket_id = 'avatars' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Avatar public read" ON storage.objects
  FOR SELECT USING (bucket_id = 'avatars');

CREATE POLICY "Avatar delete" ON storage.objects
  FOR DELETE USING (bucket_id = 'avatars' AND auth.uid()::text = (storage.foldername(name))[1]);

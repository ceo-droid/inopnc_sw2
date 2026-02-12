INSERT INTO storage.buckets (id, name, public) VALUES ('imports', 'imports', true)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Allow public read on imports" ON storage.objects FOR SELECT USING (bucket_id = 'imports');
CREATE POLICY "Allow public insert on imports" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'imports');
-- Disb Gestao v1.1.9 - HOTFIX NRI sem turno
-- Corrige compatibilidade do banco com a regra introduzida na v1.0.12:
-- o campo Turno deixou de ser usado no cadastro de NRI.
-- Registros antigos com turno sao preservados; novos registros podem gravar NULL.

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
      FROM information_schema.columns
     WHERE table_schema = 'public'
       AND table_name = 'nri_requests'
       AND column_name = 'shift'
  ) THEN
    EXECUTE 'ALTER TABLE public.nri_requests ALTER COLUMN shift DROP NOT NULL';
    EXECUTE 'ALTER TABLE public.nri_requests ALTER COLUMN shift DROP DEFAULT';
  END IF;

  IF EXISTS (
    SELECT 1
      FROM information_schema.columns
     WHERE table_schema = 'public'
       AND table_name = 'nris'
       AND column_name = 'shift'
  ) THEN
    EXECUTE 'ALTER TABLE public.nris ALTER COLUMN shift DROP NOT NULL';
    EXECUTE 'ALTER TABLE public.nris ALTER COLUMN shift DROP DEFAULT';
  END IF;
END
$$;

-- Diagnostico final: se as colunas existirem, is_nullable deve ser YES.
SELECT
  table_name,
  column_name,
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name IN ('nri_requests','nris')
  AND column_name = 'shift'
ORDER BY table_name;

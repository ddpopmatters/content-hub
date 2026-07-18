-- Bind approval to the exact provider-facing content revision.
-- Existing approvals intentionally remain unbound and fail closed until re-approved.

ALTER TABLE public.entries
  ADD COLUMN IF NOT EXISTS content_revision BIGINT NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS approved_revision BIGINT;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'entries_content_revision_positive'
      AND conrelid = 'public.entries'::regclass
  ) THEN
    ALTER TABLE public.entries
      ADD CONSTRAINT entries_content_revision_positive
      CHECK (content_revision > 0);
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'entries_approved_revision_valid'
      AND conrelid = 'public.entries'::regclass
  ) THEN
    ALTER TABLE public.entries
      ADD CONSTRAINT entries_approved_revision_valid
      CHECK (
        approved_revision IS NULL
        OR (approved_revision > 0 AND approved_revision <= content_revision)
      );
  END IF;
END
$$;

CREATE OR REPLACE FUNCTION public.maintain_entry_publication_revision()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = ''
AS $$
DECLARE
  publication_content_changed BOOLEAN;
BEGIN
  IF TG_OP = 'INSERT' THEN
    NEW.content_revision := 1;
    NEW.approved_revision := CASE
      WHEN NEW.workflow_status = 'Approved' AND NEW.approved_at IS NOT NULL THEN 1
      ELSE NULL
    END;
    RETURN NEW;
  END IF;

  publication_content_changed :=
    NEW.platforms IS DISTINCT FROM OLD.platforms
    OR NEW.asset_type IS DISTINCT FROM OLD.asset_type
    OR NEW.caption IS DISTINCT FROM OLD.caption
    OR NEW.platform_captions IS DISTINCT FROM OLD.platform_captions
    OR NEW.first_comment IS DISTINCT FROM OLD.first_comment
    OR NEW.asset_previews IS DISTINCT FROM OLD.asset_previews
    OR NEW.preview_url IS DISTINCT FROM OLD.preview_url;

  -- Revision fields are database-owned; ignore direct client changes.
  NEW.content_revision := OLD.content_revision;
  NEW.approved_revision := OLD.approved_revision;

  IF publication_content_changed THEN
    NEW.content_revision := OLD.content_revision + 1;
    NEW.approved_revision := NULL;
    NEW.approved_at := NULL;
    NEW.status := 'Pending';

    IF NEW.workflow_status IN ('Approved', 'Scheduled', 'Published') THEN
      NEW.workflow_status := 'In Review';
    END IF;

    RETURN NEW;
  END IF;

  IF NEW.workflow_status = 'Approved' AND NEW.approved_at IS NOT NULL THEN
    IF
      OLD.workflow_status IS DISTINCT FROM NEW.workflow_status
      OR OLD.approved_at IS DISTINCT FROM NEW.approved_at
    THEN
      NEW.approved_revision := NEW.content_revision;
    END IF;
  ELSIF
    NEW.workflow_status = 'Published'
    AND NEW.approved_at IS NOT NULL
    AND OLD.approved_revision = OLD.content_revision
  THEN
    NEW.approved_revision := OLD.approved_revision;
  ELSE
    NEW.approved_revision := NULL;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS maintain_entry_publication_revision ON public.entries;
CREATE TRIGGER maintain_entry_publication_revision
  BEFORE INSERT OR UPDATE ON public.entries
  FOR EACH ROW
  EXECUTE FUNCTION public.maintain_entry_publication_revision();

COMMENT ON COLUMN public.entries.content_revision IS
  'Monotonic database-owned revision for fields sent to social providers.';

COMMENT ON COLUMN public.entries.approved_revision IS
  'Content revision most recently approved; null until the current revision is approved.';

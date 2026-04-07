-- Migration 114: F1 Memory — triggers auto-insert project_memory_entries

-- Trigger: after voice_note reaches 'processed' status with extracted_result
CREATE OR REPLACE FUNCTION fn_voice_note_to_memory()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_summary text;
  v_decisions jsonb;
  v_amounts   jsonb;
  v_hint      text;
  v_entry     text;
  v_amount    jsonb;
BEGIN
  -- Only fire when status transitions to 'processed' and project is set
  IF NEW.status <> 'processed' THEN RETURN NEW; END IF;
  IF OLD.status = 'processed' THEN RETURN NEW; END IF;
  IF NEW.project_id IS NULL THEN RETURN NEW; END IF;
  IF NEW.extracted_result IS NULL THEN RETURN NEW; END IF;

  v_summary   := NEW.extracted_result->>'summary';
  v_decisions := NEW.extracted_result->'decisions';
  v_amounts   := NEW.extracted_result->'amounts';
  v_hint      := NEW.extracted_result->>'estimate_hint';

  -- Insert summary as event
  IF v_summary IS NOT NULL AND v_summary <> '' THEN
    INSERT INTO project_memory_entries
      (company_id, project_id, memory_type, topic, content, source_type, source_id)
    VALUES
      (NEW.company_id, NEW.project_id, 'event', 'głos', v_summary, 'voice_note', NEW.id);
  END IF;

  -- Insert each decision
  IF jsonb_array_length(v_decisions) > 0 THEN
    FOR v_entry IN SELECT jsonb_array_elements_text(v_decisions) LOOP
      INSERT INTO project_memory_entries
        (company_id, project_id, memory_type, topic, content, source_type, source_id)
      VALUES
        (NEW.company_id, NEW.project_id, 'decision', 'głos', v_entry, 'voice_note', NEW.id);
    END LOOP;
  END IF;

  -- Insert detected amounts
  IF v_amounts IS NOT NULL AND jsonb_array_length(v_amounts) > 0 THEN
    FOR v_amount IN SELECT jsonb_array_elements(v_amounts) LOOP
      INSERT INTO project_memory_entries
        (company_id, project_id, memory_type, topic, content, source_type, source_id)
      VALUES
        (NEW.company_id, NEW.project_id, 'amount', 'kwota',
         (v_amount->>'description') || ': ' || (v_amount->>'amount') || ' ' || COALESCE(v_amount->>'currency', 'PLN'),
         'voice_note', NEW.id);
    END LOOP;
  END IF;

  -- Insert estimate hint as preference
  IF v_hint IS NOT NULL AND v_hint <> '' THEN
    INSERT INTO project_memory_entries
      (company_id, project_id, memory_type, topic, content, source_type, source_id)
    VALUES
      (NEW.company_id, NEW.project_id, 'preference', 'wycena', v_hint, 'voice_note', NEW.id);
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_voice_note_to_memory ON voice_notes;
CREATE TRIGGER trg_voice_note_to_memory
  AFTER UPDATE OF status ON voice_notes
  FOR EACH ROW EXECUTE FUNCTION fn_voice_note_to_memory();

-- Trigger: after client_decision insert (if table exists)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'client_decisions') THEN
    EXECUTE $t$
      CREATE OR REPLACE FUNCTION fn_client_decision_to_memory()
      RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER AS $f$
      BEGIN
        IF NEW.project_id IS NULL THEN RETURN NEW; END IF;
        INSERT INTO project_memory_entries
          (company_id, project_id, memory_type, topic, content, source_type, source_id)
        VALUES
          (NEW.company_id, NEW.project_id, 'decision', 'klient',
           COALESCE(NEW.description, NEW.title, ''), 'client_decision', NEW.id);
        RETURN NEW;
      END;
      $f$;

      DROP TRIGGER IF EXISTS trg_client_decision_to_memory ON client_decisions;
      CREATE TRIGGER trg_client_decision_to_memory
        AFTER INSERT ON client_decisions
        FOR EACH ROW EXECUTE FUNCTION fn_client_decision_to_memory();
    $t$;
  END IF;
END;
$$;

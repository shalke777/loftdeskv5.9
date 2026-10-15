ALTER TABLE public.operator_notifications DROP CONSTRAINT IF EXISTS operator_notifications_type_check;
ALTER TABLE public.operator_notifications ADD CONSTRAINT operator_notifications_type_check
 CHECK(type IN ('client_message','client_approval_response','missing_costs','payment_reminder','automation'));
CREATE UNIQUE INDEX IF NOT EXISTS automation_notification_once
 ON public.operator_notifications(company_id,reference_id) WHERE type='automation';
CREATE OR REPLACE FUNCTION public.notify_private_automation() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
BEGIN
 IF NEW.status IS NOT DISTINCT FROM OLD.status THEN RETURN NEW; END IF;
 IF NEW.status IN ('failed','unknown') OR (NEW.status='done' AND NEW.kind IN ('estimate.draft','gmail.draft')) THEN
  INSERT INTO public.operator_notifications(company_id,type,title,body,reference_id)
  VALUES(NEW.company_id,'automation',
   CASE WHEN NEW.status='done' THEN 'Zadanie asystenta gotowe' ELSE 'Zadanie wymaga uwagi' END,
   CASE WHEN NEW.status='done' THEN NEW.kind||COALESCE(' · '||(NEW.result->>'number'),'')
    ELSE NEW.kind||' · '||COALESCE(NEW.last_error,'Sprawdź wynik w ustawieniach integracji.') END,NEW.id)
  ON CONFLICT(company_id,reference_id) WHERE type='automation' DO NOTHING;
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER notify_private_automation AFTER UPDATE OF status ON public.automation_jobs
 FOR EACH ROW EXECUTE FUNCTION public.notify_private_automation();

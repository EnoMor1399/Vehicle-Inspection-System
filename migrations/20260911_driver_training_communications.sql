BEGIN;

CREATE TABLE IF NOT EXISTS training_communication_preferences (
  id varchar(36) PRIMARY KEY,
  participant_id varchar(36) NOT NULL REFERENCES training_participants(id) ON DELETE CASCADE,
  email_opt_in boolean NOT NULL DEFAULT false,
  sms_opt_in boolean NOT NULL DEFAULT false,
  whatsapp_opt_in boolean NOT NULL DEFAULT false,
  preferred_channel varchar(20),
  do_not_contact boolean NOT NULL DEFAULT false,
  consent_source varchar(500) NOT NULL,
  consent_recorded_at timestamptz NOT NULL DEFAULT now(),
  consent_recorded_by varchar(36) REFERENCES users(id) ON DELETE SET NULL,
  notes text,
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT training_comm_pref_channel_chk CHECK (preferred_channel IS NULL OR preferred_channel IN ('email', 'sms', 'whatsapp')),
  CONSTRAINT training_comm_pref_dnc_chk CHECK (NOT do_not_contact OR (NOT email_opt_in AND NOT sms_opt_in AND NOT whatsapp_opt_in)),
  CONSTRAINT training_comm_pref_source_chk CHECK (length(trim(consent_source)) >= 2)
);

CREATE TABLE IF NOT EXISTS training_outbound_messages (
  id varchar(36) PRIMARY KEY,
  participant_id varchar(36) NOT NULL REFERENCES training_participants(id) ON DELETE CASCADE,
  session_id varchar(36) REFERENCES training_sessions(id) ON DELETE SET NULL,
  certificate_id varchar(36) REFERENCES training_certificates(id) ON DELETE SET NULL,
  message_type varchar(40) NOT NULL,
  channel varchar(20) NOT NULL,
  recipient_name varchar(200) NOT NULL,
  recipient_address varchar(255) NOT NULL,
  subject varchar(255),
  body text NOT NULL,
  status varchar(20) NOT NULL DEFAULT 'draft',
  prepared_by varchar(36) REFERENCES users(id) ON DELETE SET NULL,
  approved_by varchar(36) REFERENCES users(id) ON DELETE SET NULL,
  approved_at timestamptz,
  queued_at timestamptz,
  provider_message_id varchar(255),
  sent_at timestamptz,
  failed_at timestamptz,
  failure_reason text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT training_outbound_type_chk CHECK (message_type IN ('session_invitation', 'session_reminder', 'session_change', 'certificate_expiry', 'renewal_follow_up', 'assessment_follow_up', 'general')),
  CONSTRAINT training_outbound_channel_chk CHECK (channel IN ('email', 'sms', 'whatsapp')),
  CONSTRAINT training_outbound_status_chk CHECK (status IN ('draft', 'approved', 'queued', 'sent', 'failed', 'cancelled')),
  CONSTRAINT training_outbound_recipient_chk CHECK (length(trim(recipient_name)) >= 2 AND length(trim(recipient_address)) >= 3),
  CONSTRAINT training_outbound_body_chk CHECK (length(trim(body)) >= 2),
  CONSTRAINT training_outbound_approval_chk CHECK (status NOT IN ('approved', 'queued', 'sent', 'failed') OR (approved_by IS NOT NULL AND approved_at IS NOT NULL)),
  CONSTRAINT training_outbound_queue_chk CHECK (status NOT IN ('queued', 'sent', 'failed') OR queued_at IS NOT NULL),
  CONSTRAINT training_outbound_sent_chk CHECK (status <> 'sent' OR sent_at IS NOT NULL),
  CONSTRAINT training_outbound_failed_chk CHECK (status <> 'failed' OR (failed_at IS NOT NULL AND failure_reason IS NOT NULL AND length(trim(failure_reason)) >= 2))
);

CREATE TABLE IF NOT EXISTS training_communication_events (
  id varchar(36) PRIMARY KEY,
  message_id varchar(36) NOT NULL REFERENCES training_outbound_messages(id) ON DELETE CASCADE,
  event_type varchar(30) NOT NULL,
  from_status varchar(20),
  to_status varchar(20),
  summary text NOT NULL,
  created_by varchar(36) REFERENCES users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS training_comm_pref_participant_uidx ON training_communication_preferences(participant_id);
CREATE INDEX IF NOT EXISTS training_comm_pref_channel_idx ON training_communication_preferences(preferred_channel);
CREATE INDEX IF NOT EXISTS training_comm_pref_dnc_idx ON training_communication_preferences(do_not_contact);
CREATE INDEX IF NOT EXISTS training_outbound_participant_idx ON training_outbound_messages(participant_id, created_at);
CREATE INDEX IF NOT EXISTS training_outbound_session_idx ON training_outbound_messages(session_id, status);
CREATE INDEX IF NOT EXISTS training_outbound_certificate_idx ON training_outbound_messages(certificate_id);
CREATE INDEX IF NOT EXISTS training_outbound_status_idx ON training_outbound_messages(status, created_at);
CREATE INDEX IF NOT EXISTS training_outbound_queue_idx ON training_outbound_messages(status, queued_at);
CREATE INDEX IF NOT EXISTS training_comm_event_message_created_idx ON training_communication_events(message_id, created_at);

CREATE OR REPLACE FUNCTION enforce_training_message_queue_consent()
RETURNS trigger AS $$
DECLARE
  pref training_communication_preferences%ROWTYPE;
  participant training_participants%ROWTYPE;
  expected_address text;
  opted_in boolean;
BEGIN
  IF NEW.status = 'queued' AND (TG_OP = 'INSERT' OR OLD.status IS DISTINCT FROM NEW.status) THEN
    SELECT * INTO pref FROM training_communication_preferences WHERE participant_id = NEW.participant_id;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'Participant communication preference is required before queueing an external message';
    END IF;
    IF pref.do_not_contact THEN
      RAISE EXCEPTION 'Participant is marked do not contact';
    END IF;

    SELECT * INTO participant FROM training_participants WHERE id = NEW.participant_id;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'Training participant not found';
    END IF;

    IF NEW.channel = 'email' THEN
      opted_in := pref.email_opt_in;
      expected_address := lower(trim(participant.email));
      IF lower(trim(NEW.recipient_address)) IS DISTINCT FROM expected_address THEN
        RAISE EXCEPTION 'Queued email destination must match the participant current email address';
      END IF;
    ELSIF NEW.channel = 'sms' THEN
      opted_in := pref.sms_opt_in;
      expected_address := trim(participant.phone);
      IF trim(NEW.recipient_address) IS DISTINCT FROM expected_address THEN
        RAISE EXCEPTION 'Queued SMS destination must match the participant current phone number';
      END IF;
    ELSIF NEW.channel = 'whatsapp' THEN
      opted_in := pref.whatsapp_opt_in;
      expected_address := trim(participant.phone);
      IF trim(NEW.recipient_address) IS DISTINCT FROM expected_address THEN
        RAISE EXCEPTION 'Queued WhatsApp destination must match the participant current phone number';
      END IF;
    ELSE
      RAISE EXCEPTION 'Unsupported outbound communication channel';
    END IF;

    IF NOT opted_in THEN
      RAISE EXCEPTION 'Participant has not opted in to the selected communication channel';
    END IF;
    IF expected_address IS NULL OR length(expected_address) < 3 THEN
      RAISE EXCEPTION 'Participant has no usable destination for the selected communication channel';
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_training_message_queue_consent ON training_outbound_messages;
CREATE TRIGGER trg_training_message_queue_consent
BEFORE INSERT OR UPDATE OF status, channel, recipient_address, participant_id
ON training_outbound_messages
FOR EACH ROW
EXECUTE FUNCTION enforce_training_message_queue_consent();

COMMIT;

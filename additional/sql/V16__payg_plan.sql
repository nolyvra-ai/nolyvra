-- Add Pay-As-You-Go plan
INSERT INTO plans (id, name, max_jobs, max_candidates, max_tokens)
VALUES ('plan-payg', 'PAYG', 10, 30, 100)
ON CONFLICT (id) DO NOTHING;

-- Update candidate limits for Bronze, Silver, Gold
UPDATE plans SET max_candidates = 150  WHERE id = 'plan-bronze';
UPDATE plans SET max_candidates = 750  WHERE id = 'plan-silver';
UPDATE plans SET max_candidates = 2250 WHERE id = 'plan-gold';

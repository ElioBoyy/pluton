-- Unipile is gone: its LinkedIn accounts carry on as manual ones, their steps coming as tasks.
UPDATE `sender` SET `provider` = 'manual', `external_id` = NULL, `status` = 'connected', `error` = NULL WHERE `provider` = 'unipile';

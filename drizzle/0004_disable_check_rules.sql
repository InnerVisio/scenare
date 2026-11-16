UPDATE lookup_items SET data = jsonb_set(data, '{enabled}', 'false'::jsonb) WHERE kind = 'check_rule';

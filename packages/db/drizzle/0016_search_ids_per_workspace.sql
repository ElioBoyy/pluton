-- Search ids carry their workspace ("<workspaceId>:<kind>:<refId>"), so two workspaces never share a row. Embeddings are kept.
UPDATE `search_document` SET `id` = `workspace_id` || ':' || `id` WHERE `id` NOT LIKE `workspace_id` || ':%';

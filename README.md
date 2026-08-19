# Ava on AskFRED

Static website: https://jolly-smoke-0fbf91610.7.azurestaticapps.net

This repository contains a test page for the CollegeVine Trellis webchat embed.

## Feedback API

The landing-page survey posts to `POST /api/feedback`. The managed Azure Function stores responses in Azure Table Storage.

Configure these application settings in the Azure Static Web App:

- `FEEDBACK_STORAGE_CONNECTION_STRING` (required): the Table Storage connection string.
- `FEEDBACK_TABLE_NAME` (optional): the destination table name. Defaults to `AvaFeedback`.

For local development, copy `api/local.settings.example.json` to `api/local.settings.json` and replace the placeholder connection string. The local settings file is ignored by Git.

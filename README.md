# Ava on AskFRED

Static website: https://jolly-smoke-0fbf91610.7.azurestaticapps.net

This repository contains a test page for the CollegeVine Trellis webchat embed.

## Feedback API

The landing-page survey and `POST /api/feedback` registration are currently disabled. The handler remains in the codebase so collection can be restored later.

Configure these application settings in the Azure Static Web App:

- `FEEDBACK_STORAGE_CONNECTION_STRING` (required): the Table Storage connection string.
- `FEEDBACK_TABLE_NAME` (optional): the destination table name. Defaults to `AvaFeedback`.
- `FEEDBACK_ADMIN_EMAILS` (required for results): comma-separated Microsoft Entra email addresses allowed to view feedback results.

For local development, copy `api/local.settings.example.json` to `api/local.settings.json` and replace the placeholder connection string. The local settings file is ignored by Git.

## Feedback results

Authorized reviewers can open `/feedback-admin`, sign in with Microsoft Entra ID, and view the protected results dashboard. The page requires an authenticated account, and the results API only returns comments when the signed-in email is listed in `FEEDBACK_ADMIN_EMAILS`.

const { TableClient } = require("@azure/data-tables");

const DEFAULT_TABLE_NAME = "AvaFeedback";

let tableClient;

function getFeedbackTableClient() {
  if (!tableClient) {
    const connectionString = process.env.FEEDBACK_STORAGE_CONNECTION_STRING;
    if (!connectionString) throw new Error("FEEDBACK_STORAGE_CONNECTION_STRING is not configured.");

    const tableName = process.env.FEEDBACK_TABLE_NAME || DEFAULT_TABLE_NAME;
    tableClient = TableClient.fromConnectionString(connectionString, tableName);
  }

  return tableClient;
}

async function getOrCreateFeedbackTableClient() {
  const client = getFeedbackTableClient();
  await client.createTable();
  return client;
}

module.exports = { getFeedbackTableClient, getOrCreateFeedbackTableClient };

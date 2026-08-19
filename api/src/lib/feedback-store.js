const { TableClient } = require("@azure/data-tables");

const DEFAULT_TABLE_NAME = "AvaFeedback";

let tableClientPromise;

async function getFeedbackTableClient() {
  if (!tableClientPromise) {
    tableClientPromise = (async () => {
      const connectionString = process.env.FEEDBACK_STORAGE_CONNECTION_STRING;
      if (!connectionString) throw new Error("FEEDBACK_STORAGE_CONNECTION_STRING is not configured.");

      const tableName = process.env.FEEDBACK_TABLE_NAME || DEFAULT_TABLE_NAME;
      const client = TableClient.fromConnectionString(connectionString, tableName);
      await client.createTable();
      return client;
    })();
  }

  return tableClientPromise;
}

module.exports = { getFeedbackTableClient };

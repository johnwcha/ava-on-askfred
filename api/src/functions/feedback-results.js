const { app } = require("@azure/functions");
const { getFeedbackTableClient } = require("../lib/feedback-store");

const ADMIN_ROLE = "feedback_admin";
const ALLOWED_PERIODS = new Set([7, 30, 90]);
const ALLOWED_RATINGS = new Set(["all", "positive", "negative"]);
const MAX_RESULTS = 500;

function parseClientPrincipal(request) {
  const header = request.headers.get("x-ms-client-principal");
  if (!header) return null;

  try {
    return JSON.parse(Buffer.from(header, "base64").toString("utf8"));
  } catch {
    return null;
  }
}

function hasAdminRole(request) {
  const principal = parseClientPrincipal(request);
  return Array.isArray(principal?.userRoles) && principal.userRoles.includes(ADMIN_ROLE);
}

function getQueryOptions(request) {
  const daysValue = Number(request.query.get("days") || 30);
  const ratingValue = request.query.get("rating") || "all";

  return {
    days: ALLOWED_PERIODS.has(daysValue) ? daysValue : 30,
    rating: ALLOWED_RATINGS.has(ratingValue) ? ratingValue : "all"
  };
}

function getPartitionKeys(days, now = new Date()) {
  const cutoff = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
  const cursor = new Date(Date.UTC(cutoff.getUTCFullYear(), cutoff.getUTCMonth(), 1));
  const end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const keys = [];

  while (cursor <= end) {
    keys.push(cursor.toISOString().slice(0, 7));
    cursor.setUTCMonth(cursor.getUTCMonth() + 1);
  }

  return keys;
}

async function feedbackResultsHandler(request, context) {
  if (!hasAdminRole(request)) {
    return {
      status: 403,
      headers: { "Cache-Control": "no-store" },
      jsonBody: { error: "Feedback administrator access is required." }
    };
  }

  const { days, rating } = getQueryOptions(request);
  const now = new Date();
  const cutoff = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
  const partitionFilter = getPartitionKeys(days, now)
    .map((key) => `PartitionKey eq '${key}'`)
    .join(" or ");

  try {
    const client = await getFeedbackTableClient();
    const responses = [];

    for await (const entity of client.listEntities({
      queryOptions: {
        filter: partitionFilter,
        select: ["RowKey", "rating", "comment", "page", "chatOpen", "submittedAt"]
      }
    })) {
      const submittedAt = new Date(entity.submittedAt);
      if (Number.isNaN(submittedAt.getTime()) || submittedAt < cutoff) continue;
      if (rating !== "all" && entity.rating !== rating) continue;

      responses.push({
        id: entity.rowKey,
        rating: entity.rating,
        comment: entity.comment || "",
        page: entity.page || "/",
        chatOpen: entity.chatOpen === true,
        submittedAt: submittedAt.toISOString()
      });

      if (responses.length > MAX_RESULTS) break;
    }

    responses.sort((a, b) => b.submittedAt.localeCompare(a.submittedAt));
    const truncated = responses.length > MAX_RESULTS;

    return {
      status: 200,
      headers: { "Cache-Control": "no-store" },
      jsonBody: {
        responses: responses.slice(0, MAX_RESULTS),
        truncated,
        periodDays: days
      }
    };
  } catch (error) {
    context.error("Feedback results query failed", error.message);
    return {
      status: 500,
      headers: { "Cache-Control": "no-store" },
      jsonBody: { error: "Feedback results could not be loaded." }
    };
  }
}

app.http("feedback-results", {
  methods: ["GET"],
  authLevel: "anonymous",
  route: "feedback-results",
  handler: feedbackResultsHandler
});

module.exports = {
  feedbackResultsHandler,
  getPartitionKeys,
  getQueryOptions,
  hasAdminRole,
  parseClientPrincipal
};

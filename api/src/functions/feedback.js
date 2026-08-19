const { randomUUID } = require("node:crypto");
const { app } = require("@azure/functions");
const { getFeedbackTableClient } = require("../lib/feedback-store");

const MAX_COMMENT_LENGTH = 1000;
const VALID_RATINGS = new Set(["positive", "negative"]);
const REQUEST_ID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function validateFeedback(payload) {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    return { error: "A JSON object is required." };
  }

  if (!VALID_RATINGS.has(payload.rating)) {
    return { error: "Rating must be positive or negative." };
  }

  if (payload.comment !== undefined && typeof payload.comment !== "string") {
    return { error: "Comment must be text." };
  }

  const comment = (payload.comment || "")
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "")
    .trim();
  if (comment.length > MAX_COMMENT_LENGTH) {
    return { error: `Comment must be ${MAX_COMMENT_LENGTH} characters or fewer.` };
  }

  const page = typeof payload.page === "string" ? payload.page.slice(0, 200) : "/";

  return {
    value: {
      rating: payload.rating,
      comment,
      page,
      chatOpen: payload.chatOpen === true
    }
  };
}

async function feedbackHandler(request, context) {
  const contentType = request.headers.get("content-type") || "";
  if (!contentType.toLowerCase().includes("application/json")) {
    return { status: 415, jsonBody: { error: "Content-Type must be application/json." } };
  }

  let payload;
  try {
    payload = await request.json();
  } catch {
    return { status: 400, jsonBody: { error: "Request body must be valid JSON." } };
  }

  const result = validateFeedback(payload);
  if (result.error) return { status: 400, jsonBody: { error: result.error } };

  const requestIdHeader = request.headers.get("x-feedback-id") || "";
  const rowKey = REQUEST_ID_PATTERN.test(requestIdHeader) ? requestIdHeader : randomUUID();
  const submittedAt = new Date().toISOString();
  const partitionKey = submittedAt.slice(0, 7);

  try {
    const client = await getFeedbackTableClient();
    await client.createEntity({
      partitionKey,
      rowKey,
      rating: result.value.rating,
      comment: result.value.comment,
      page: result.value.page,
      chatOpen: result.value.chatOpen,
      submittedAt
    });

    return {
      status: 201,
      headers: { "Cache-Control": "no-store" },
      jsonBody: { id: rowKey }
    };
  } catch (error) {
    if (error.statusCode === 409) {
      return {
        status: 200,
        headers: { "Cache-Control": "no-store" },
        jsonBody: { id: rowKey }
      };
    }

    context.error("Feedback storage failed", error.message);
    return {
      status: 500,
      headers: { "Cache-Control": "no-store" },
      jsonBody: { error: "Feedback could not be stored." }
    };
  }
}

app.http("feedback", {
  methods: ["POST"],
  authLevel: "anonymous",
  route: "feedback",
  handler: feedbackHandler
});

module.exports = { feedbackHandler, validateFeedback };

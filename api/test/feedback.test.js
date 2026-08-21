const test = require("node:test");
const assert = require("node:assert/strict");
const { feedbackHandler, validateFeedback } = require("../src/functions/feedback");

test("accepts a valid rating with an optional comment", () => {
  assert.deepEqual(
    validateFeedback({ rating: "positive", comment: " Helpful ", page: "/", chatOpen: true }),
    {
      value: {
        rating: "positive",
        comment: "Helpful",
        page: "/",
        chatOpen: true
      }
    }
  );
});

test("accepts a positive rating without a comment", () => {
  const result = validateFeedback({ rating: "positive" });
  assert.equal(result.value.comment, "");
});

test("rejects a negative rating without a comment", () => {
  assert.deepEqual(validateFeedback({ rating: "negative", comment: "   " }), {
    error: "Comment is required for a negative rating."
  });
});

test("rejects an unsupported rating", () => {
  assert.deepEqual(validateFeedback({ rating: "neutral" }), {
    error: "Rating must be positive or negative."
  });
});

test("rejects a comment longer than 1000 characters", () => {
  const result = validateFeedback({ rating: "positive", comment: "x".repeat(1001) });
  assert.equal(result.error, "Comment must be 1000 characters or fewer.");
});

test("removes unsupported control characters from comments", () => {
  const result = validateFeedback({ rating: "positive", comment: "Helpful\u0000 response" });
  assert.equal(result.value.comment, "Helpful response");
});

test("rejects requests that are not JSON", async () => {
  const response = await feedbackHandler({
    headers: new Headers({ "content-type": "text/plain" })
  });

  assert.equal(response.status, 415);
});

test("returns validation errors before accessing storage", async () => {
  const response = await feedbackHandler(
    {
      headers: new Headers({ "content-type": "application/json" }),
      json: async () => ({ rating: "neutral" })
    },
    { error() {} }
  );

  assert.equal(response.status, 400);
  assert.equal(response.jsonBody.error, "Rating must be positive or negative.");
});

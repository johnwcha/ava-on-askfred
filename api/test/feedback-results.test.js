const test = require("node:test");
const assert = require("node:assert/strict");
const {
  feedbackAdminAccessHandler,
  feedbackResultsHandler,
  getApprovedAdminEmails,
  getPartitionKeys,
  getQueryOptions,
  hasAdminAccess,
  parseClientPrincipal
} = require("../src/functions/feedback-results");

function requestWithPrincipal(userRoles = [], userDetails = "admin@example.edu", identityProvider = "aad") {
  const principal = Buffer.from(JSON.stringify({
    identityProvider,
    userDetails,
    userRoles
  })).toString("base64");

  return {
    headers: new Headers({ "x-ms-client-principal": principal }),
    query: new URLSearchParams()
  };
}

function restoreAdminEmails(previousValue) {
  if (previousValue === undefined) delete process.env.FEEDBACK_ADMIN_EMAILS;
  else process.env.FEEDBACK_ADMIN_EMAILS = previousValue;
}

test("parses the Static Web Apps client principal", () => {
  const request = requestWithPrincipal(["authenticated"]);
  assert.equal(parseClientPrincipal(request).userDetails, "admin@example.edu");
});

test("normalizes configured administrator emails", () => {
  assert.deepEqual([...getApprovedAdminEmails(" Admin@example.edu, reviewer@example.edu ")], [
    "admin@example.edu",
    "reviewer@example.edu"
  ]);
});

test("allows an authenticated Microsoft account on the email allowlist", () => {
  const previousValue = process.env.FEEDBACK_ADMIN_EMAILS;
  process.env.FEEDBACK_ADMIN_EMAILS = "admin@example.edu";
  assert.equal(hasAdminAccess(requestWithPrincipal(["authenticated"])), true);
  restoreAdminEmails(previousValue);
});

test("rejects an authenticated email that is not approved", () => {
  const previousValue = process.env.FEEDBACK_ADMIN_EMAILS;
  process.env.FEEDBACK_ADMIN_EMAILS = "reviewer@example.edu";
  assert.equal(hasAdminAccess(requestWithPrincipal(["authenticated"])), false);
  restoreAdminEmails(previousValue);
});

test("rejects a matching email from a non-Microsoft provider", () => {
  const previousValue = process.env.FEEDBACK_ADMIN_EMAILS;
  process.env.FEEDBACK_ADMIN_EMAILS = "admin@example.edu";
  assert.equal(hasAdminAccess(requestWithPrincipal(["authenticated"], "admin@example.edu", "github")), false);
  restoreAdminEmails(previousValue);
});

test("returns no content when an approved administrator checks access", () => {
  const previousValue = process.env.FEEDBACK_ADMIN_EMAILS;
  process.env.FEEDBACK_ADMIN_EMAILS = "admin@example.edu";
  const response = feedbackAdminAccessHandler(requestWithPrincipal(["authenticated"]));
  assert.equal(response.status, 204);
  restoreAdminEmails(previousValue);
});

test("forbids an unapproved administrator access check", () => {
  const previousValue = process.env.FEEDBACK_ADMIN_EMAILS;
  process.env.FEEDBACK_ADMIN_EMAILS = "reviewer@example.edu";
  const response = feedbackAdminAccessHandler(requestWithPrincipal(["authenticated"]));
  assert.equal(response.status, 403);
  restoreAdminEmails(previousValue);
});

test("uses safe defaults for unsupported query options", () => {
  const request = requestWithPrincipal(["feedback_admin"]);
  request.query = new URLSearchParams({ days: "365", rating: "neutral" });
  assert.deepEqual(getQueryOptions(request), { days: 30, rating: "all" });
});

test("builds monthly partition keys across a date boundary", () => {
  const keys = getPartitionKeys(30, new Date("2026-08-19T12:00:00Z"));
  assert.deepEqual(keys, ["2026-07", "2026-08"]);
});

test("returns forbidden before querying storage", async () => {
  const previousValue = process.env.FEEDBACK_ADMIN_EMAILS;
  process.env.FEEDBACK_ADMIN_EMAILS = "reviewer@example.edu";
  const response = await feedbackResultsHandler(requestWithPrincipal(["authenticated"]), { error() {} });
  assert.equal(response.status, 403);
  restoreAdminEmails(previousValue);
});

const test = require("node:test");
const assert = require("node:assert/strict");
const {
  feedbackResultsHandler,
  getPartitionKeys,
  getQueryOptions,
  hasAdminRole,
  parseClientPrincipal
} = require("../src/functions/feedback-results");

function requestWithPrincipal(userRoles = []) {
  const principal = Buffer.from(JSON.stringify({
    identityProvider: "aad",
    userDetails: "admin@example.edu",
    userRoles
  })).toString("base64");

  return {
    headers: new Headers({ "x-ms-client-principal": principal }),
    query: new URLSearchParams()
  };
}

test("parses the Static Web Apps client principal", () => {
  const request = requestWithPrincipal(["authenticated", "feedback_admin"]);
  assert.equal(parseClientPrincipal(request).userDetails, "admin@example.edu");
  assert.equal(hasAdminRole(request), true);
});

test("rejects a principal without the feedback administrator role", () => {
  assert.equal(hasAdminRole(requestWithPrincipal(["authenticated"])), false);
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
  const response = await feedbackResultsHandler(requestWithPrincipal(["authenticated"]), { error() {} });
  assert.equal(response.status, 403);
});

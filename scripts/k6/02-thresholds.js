/**
 * Lesson 2 — Pass/fail criteria with thresholds
 *
 * thresholds let CI (or you) fail a run when latency or error rate is too high.
 *
 * Run:
 *   k6 run scripts/k6/02-thresholds.js
 *
 * Break it on purpose: set vus to 200 and see if p95 latency fails the threshold.
 */
import http from "k6/http";
import { check, sleep } from "k6";
import { API_URL } from "./config.js";

export const options = {
  vus: 10,
  duration: "15s",
  thresholds: {
    // Less than 1% of requests should fail checks
    checks: ["rate>0.99"],
    // 95th percentile response time under 50ms for this simple endpoint
    http_req_duration: ["p(95)<50"],
    // At least 50 requests per second overall
    http_reqs: ["rate>50"],
  },
};

export default function () {
  const res = http.get(`${API_URL}/api/health`);

  check(res, {
    "status is 200": (r) => r.status === 200,
  });

  sleep(0.2);
}

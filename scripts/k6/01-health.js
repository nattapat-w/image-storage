/**
 * Lesson 1 — Your first k6 test
 *
 * k6 runs JavaScript, but NOT in a browser. Each "VU" (virtual user) loops
 * the default function. options controls how many VUs and for how long.
 *
 * Run:
 *   k6 run scripts/k6/01-health.js
 *
 * Try changing vus or duration and re-run to see throughput change.
 */
import http from "k6/http";
import { check, sleep } from "k6";
import { API_URL } from "./config.js";

export const options = {
  vus: 5, // 5 virtual users hitting the API at the same time
  duration: "10s",
};

export default function () {
  const res = http.get(`${API_URL}/api/health`);

  // check() returns true/false; failed checks show up in the summary.
  check(res, {
    "status is 200": (r) => r.status === 200,
    "body has ok:true": (r) => r.json("ok") === true,
  });

  // Real users don't hammer non-stop — a short pause between iterations.
  sleep(0.5);
}

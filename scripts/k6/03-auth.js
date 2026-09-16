/**
 * Lesson 3 — Authenticated API with setup()
 *
 * setup() runs ONCE before the test. Use it for login so every VU shares one token.
 * For production load tests you'd usually create many test users; one token is fine to learn.
 *
 * Run (use your real dev account):
 *   k6 run -e PERF_EMAIL=you@example.com -e PERF_PASSWORD=secret scripts/k6/03-auth.js
 *
 * Or with pnpm:
 *   pnpm perf:auth
 */
import http from "k6/http";
import { check, sleep } from "k6";
import { API_URL, authHeaders, jsonHeaders } from "./config.js";

export const options = {
  vus: 5,
  duration: "20s",
  thresholds: {
    checks: ["rate>0.95"],
    http_req_failed: ["rate<0.05"],
    http_req_duration: ["p(95)<2000"], // DB-backed; allow more headroom than /health
  },
};

export function setup() {
  const email = __ENV.PERF_EMAIL;
  const password = __ENV.PERF_PASSWORD;

  if (!email || !password) {
    throw new Error(
      "Set PERF_EMAIL and PERF_PASSWORD env vars.\n" +
        "Example: k6 run -e PERF_EMAIL=you@example.com -e PERF_PASSWORD=secret scripts/k6/03-auth.js",
    );
  }

  const loginRes = http.post(
    `${API_URL}/api/auth/login`,
    JSON.stringify({ email, password }),
    { headers: jsonHeaders },
  );

  check(loginRes, { "login status 200": (r) => r.status === 200 });

  const token = loginRes.json("token");
  if (!token) {
    throw new Error(`login failed: ${loginRes.status} ${loginRes.body}`);
  }

  console.log(`logged in as ${email}`);
  return { token };
}

export default function (data) {
  const headers = authHeaders(data.token);

  const images = http.get(`${API_URL}/api/images`, { headers });
  check(images, {
    "images status 200": (r) => r.status === 200,
    "images returns array": (r) => Array.isArray(r.json()),
  });

  const folders = http.get(`${API_URL}/api/folders`, { headers });
  check(folders, {
    "folders status 200": (r) => r.status === 200,
  });

  sleep(1);
}

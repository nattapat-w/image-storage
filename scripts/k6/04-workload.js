/**
 * Lesson 4 — Realistic mixed workload + ramping stages
 *
 * stages[] ramps VUs up/down like real traffic patterns.
 * This script mimics a user browsing: list images → list folders → maybe download one file.
 *
 * Run:
 *   k6 run -e PERF_EMAIL=you@example.com -e PERF_PASSWORD=secret scripts/k6/04-workload.js
 *
 * Optional: pass an image id to include file downloads (heavier):
 *   k6 run -e PERF_EMAIL=... -e PERF_PASSWORD=... -e PERF_IMAGE_ID=uuid-here scripts/k6/04-workload.js
 */
import http from "k6/http";
import { check, sleep } from "k6";
import { API_URL, authHeaders, jsonHeaders } from "./config.js";

export const options = {
  stages: [
    { duration: "15s", target: 5 }, // warm up: ramp to 5 users
    { duration: "30s", target: 10 }, // hold at 10 users
    { duration: "15s", target: 0 }, // cool down
  ],
  thresholds: {
    checks: ["rate>0.95"],
    http_req_failed: ["rate<0.05"],
    "http_req_duration{endpoint:images}": ["p(95)<3000"],
    "http_req_duration{endpoint:folders}": ["p(95)<3000"],
  },
};

export function setup() {
  const email = __ENV.PERF_EMAIL;
  const password = __ENV.PERF_PASSWORD;
  const imageId = __ENV.PERF_IMAGE_ID || null;

  if (!email || !password) {
    throw new Error("Set PERF_EMAIL and PERF_PASSWORD env vars.");
  }

  const loginRes = http.post(
    `${API_URL}/api/auth/login`,
    JSON.stringify({ email, password }),
    { headers: jsonHeaders },
  );

  const token = loginRes.json("token");
  if (!token) {
    throw new Error(`login failed: ${loginRes.status} ${loginRes.body}`);
  }

  return { token, imageId };
}

export default function (data) {
  const headers = authHeaders(data.token);

  const images = http.get(`${API_URL}/api/images`, {
    headers,
    tags: { endpoint: "images" },
  });
  check(images, { "images ok": (r) => r.status === 200 });

  sleep(0.5);

  const folders = http.get(`${API_URL}/api/folders`, {
    headers,
    tags: { endpoint: "folders" },
  });
  check(folders, { "folders ok": (r) => r.status === 200 });

  // ~30% of iterations also hit file download (storage-bound — keep concurrency modest)
  if (data.imageId && Math.random() < 0.3) {
    const file = http.get(`${API_URL}/api/images/${data.imageId}/file`, {
      headers,
      tags: { endpoint: "file" },
    });
    check(file, { "file ok": (r) => r.status === 200 });
  }

  sleep(1);
}

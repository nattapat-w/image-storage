// Shared config for all k6 scripts in this repo.
// Override with env vars, e.g.:
//   k6 run -e API_URL=http://localhost:8080 -e PERF_EMAIL=you@example.com scripts/k6/03-auth.js

export const API_URL = __ENV.API_URL || "http://localhost:8080";

export const jsonHeaders = {
  "Content-Type": "application/json",
  Accept: "application/json",
};

export function authHeaders(token) {
  return {
    ...jsonHeaders,
    Authorization: `Bearer ${token}`,
  };
}

import { fileURLToPath } from "node:url";
import path from "node:path";
import { startApiServer } from "./api-dev-run.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const env = {
  ...process.env,
  STORAGE_DRIVER: "s3",
  S3_ENDPOINT: "http://127.0.0.1:9000",
  S3_REGION: "us-east-1",
  S3_BUCKET: "image-storage",
  S3_ACCESS_KEY: "minioadmin",
  S3_SECRET_KEY: "minioadmin",
  S3_USE_PATH_STYLE: "true",
};

startApiServer({ root, env });

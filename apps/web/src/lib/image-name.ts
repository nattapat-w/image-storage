const MIME_EXT: Record<string, string> = {
  "image/jpeg": ".jpg",
  "image/png": ".png",
  "image/gif": ".gif",
  "image/webp": ".webp",
};

const IMAGE_EXT = /\.(jpe?g|png|gif|webp)$/i;

export function imageExtension(name: string, mimeType?: string) {
  const match = name.match(/(\.[a-z0-9]+)$/i);
  if (match && IMAGE_EXT.test(match[1])) {
    return match[1].toLowerCase();
  }
  return mimeType ? (MIME_EXT[mimeType] ?? "") : "";
}

export function splitImageName(name: string, mimeType?: string) {
  const extension = imageExtension(name, mimeType);
  const baseName = extension && name.toLowerCase().endsWith(extension)
    ? name.slice(0, -extension.length)
    : name;
  return { baseName, extension };
}

export function displayImageName(name: string, mimeType?: string) {
  return splitImageName(name, mimeType).baseName;
}

/** Full file label including extension (inferred from mime when missing). */
export function imageFileLabel(name: string, mimeType?: string) {
  const { baseName, extension } = splitImageName(name, mimeType);
  return extension ? `${baseName}${extension}` : name;
}

export function joinImageName(baseName: string, extension: string, mimeType?: string) {
  const trimmed = baseName.trim();
  if (!trimmed) return "";
  const ext = extension || (mimeType ? (MIME_EXT[mimeType] ?? "") : "");
  if (!ext) return trimmed;
  if (trimmed.toLowerCase().endsWith(ext.toLowerCase())) return trimmed;
  return trimmed + ext;
}

import "server-only";

export const CLIENT_BUCKET = "client-docs";
export const HR_BUCKET = "hr-docs";

export const MAX_FILE_BYTES = 10 * 1024 * 1024; // 10 Mo

export const ALLOWED_MIME = new Set([
  "application/pdf",
  "image/png",
  "image/jpeg",
  "image/webp",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
]);

/** Assainit un nom de fichier pour le chemin Storage (pas d'accents/espaces). */
export function sanitizeFilename(name: string): string {
  return name
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .toLowerCase()
    .slice(0, 120) || "document";
}

/** Chemin de classement : {client_id}/{année}/{type}/{uuid}-{nom} */
export function clientDocPath(clientId: string, year: number, docType: string, filename: string): string {
  return `${clientId}/${year}/${docType}/${crypto.randomUUID()}-${sanitizeFilename(filename)}`;
}

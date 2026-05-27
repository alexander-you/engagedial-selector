/**
 * Generates a RFC 4122-compliant UUID v4.
 * Used to create a unique requestId for every engagement payload so that
 * selecting the same phone number twice still produces a distinct trigger value.
 */
export function generateGuid(): string {
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

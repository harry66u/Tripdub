"use client";

const KEY = "tripdub:device";

/** A random per-browser id so results dedupe per device. Not tied to identity. */
export function deviceId(): string {
  try {
    const existing = localStorage.getItem(KEY);
    if (existing && /^[A-Za-z0-9_-]{8,64}$/.test(existing)) return existing;
    const id = crypto.randomUUID().replace(/-/g, "");
    localStorage.setItem(KEY, id);
    return id;
  } catch {
    return `ephemeral${Math.random().toString(36).slice(2, 14)}`;
  }
}

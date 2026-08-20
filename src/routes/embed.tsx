import { createFileRoute } from "@tanstack/react-router";
import { useEffect } from "react";

import { postEmbedReady, startEmbedHeightReporting } from "@/lib/embedFrame";
import { SceneWeaverStudio } from "./index";

const DEFAULT_FRAME_ANCESTORS = [
  "'self'",
  "https://*.replit.app",
  "https://*.replit.dev",
  "https://*.repl.co",
];

function frameAncestors(): string {
  const configured = (process.env["AURORA_EMBED_ALLOWED_ORIGINS"] ?? "")
    .split(",")
    .map((origin) => origin.trim())
    .filter((origin) => /^https:\/\/(\*\.)?[a-z0-9.-]+(?::\d{1,5})?$/i.test(origin));
  return (configured.length > 0 ? ["'self'", ...configured] : DEFAULT_FRAME_ANCESTORS).join(" ");
}

export const Route = createFileRoute("/embed")({
  component: EmbedPage,
  headers: () => ({
    "Content-Security-Policy": `frame-ancestors ${frameAncestors()}`,
    // X-Frame-Options cannot express a cross-origin allow-list. CSP frame-ancestors
    // is therefore intentionally used as the authoritative framing policy.
    "X-Content-Type-Options": "nosniff",
    "Referrer-Policy": "strict-origin-when-cross-origin",
    "Permissions-Policy": "camera=(self), microphone=(), geolocation=()",
    "Cross-Origin-Resource-Policy": "cross-origin",
  }),
  head: () => ({
    meta: [
      { title: "Scene Weaver — Embedded Editor" },
      { name: "robots", content: "noindex" },
    ],
  }),
});

function EmbedPage() {
  useEffect(() => {
    postEmbedReady();
    return startEmbedHeightReporting();
  }, []);

  // Render the same editor component as the standalone app. No host styles
  // cross the iframe boundary, so Aurora cannot change Scene Weaver's look.
  return <SceneWeaverStudio />;
}
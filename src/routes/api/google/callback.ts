import { createFileRoute } from "@tanstack/react-router";

// Google redirects here after the user approves access. Verifies the signed state,
// stores the tokens server-side and sends the user back to /calendar.
export const Route = createFileRoute("/api/google/callback")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const { handleOAuthCallback } = await import("@/lib/google-calendar.server");
        return handleOAuthCallback(request);
      },
    },
  },
});

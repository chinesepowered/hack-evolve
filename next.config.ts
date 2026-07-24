import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /**
   * Replay Loop QA filed this one: the app was permanently stuck on
   * "initializing instruments…" when loaded through the public tunnel
   * ("0 React commits in the entire recording").
   *
   * Root cause: Next.js blocks cross-origin requests to dev-only assets by
   * default, so the HMR client was blocked when the page was served over the
   * tunnel host. The document rendered, the client bundle never booted, React
   * never hydrated, and the mount guard in app/page.tsx never flipped.
   *
   * Tunnels get a fresh subdomain each session, hence the wildcards.
   */
  allowedDevOrigins: [
    "*.ngrok-free.app",
    "*.ngrok.app",
    "*.ngrok.io",
    "*.trycloudflare.com",
    "*.loca.lt",
  ],
};

export default nextConfig;

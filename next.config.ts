import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // The public web form is switched off: leads come through WhatsApp, so the domain opens the admin panel.
  // Remove these to bring the form (app/page.tsx) back, e.g. for an SMS fallback link.
  async redirects() {
    return [
      { source: "/", destination: "/admin", permanent: false },
      { source: "/thank-you", destination: "/admin", permanent: false },
    ];
  },
};

export default nextConfig;

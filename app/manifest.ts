import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Outreach Console",
    short_name: "Outreach",
    description: "A focused sales CRM for calls, follow-ups, meetings, and deals.",
    start_url: "/",
    display: "standalone",
    background_color: "#faf9f6",
    theme_color: "#24304d",
    icons: [
      {
        src: "/icon.svg",
        sizes: "any",
        type: "image/svg+xml",
        purpose: "any",
      },
      {
        src: "/icon.svg",
        sizes: "any",
        type: "image/svg+xml",
        purpose: "maskable",
      },
    ],
  };
}

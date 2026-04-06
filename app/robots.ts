import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/api/", "/intake/", "/kid-dashboard/"],
    },
    sitemap: "https://autisense.imaginaerium.in/sitemap.xml",
  };
}

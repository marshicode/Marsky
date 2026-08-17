import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Marsky — one list, two people, zero nagging",
    short_name: "Marsky",
    description:
      "A shared reminder list for two. Pair in seconds, remind each other, check in together.",
    start_url: "/",
    display: "standalone",
    background_color: "#FFF8F2",
    theme_color: "#F97316",
    icons: [{ src: "/icon.svg", sizes: "any", type: "image/svg+xml" }],
  };
}

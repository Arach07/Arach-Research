import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Research — raporty rynkowe",
    short_name: "Research",
    description: "Codzienne raporty: giełda, złoto, krypto i ostrzeżenia przed scamami",
    start_url: "/",
    display: "standalone",
    background_color: "#07070a",
    theme_color: "#07070a",
    icons: [{ src: "/icon.svg", sizes: "any", type: "image/svg+xml" }],
  };
}

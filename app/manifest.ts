import type { MetadataRoute } from "next";
export default function manifest(): MetadataRoute.Manifest {
  return { name: "Concurseiro CLT", short_name: "Concurseiro", description: "Sistema adaptativo de estudos para concursos", start_url: "/dashboard", display: "standalone", background_color: "#f4f7fb", theme_color: "#10233f" };
}

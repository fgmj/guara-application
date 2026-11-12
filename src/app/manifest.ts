import type { MetadataRoute } from "next";

// Permite "instalar" o Guará no celular dos entregadores (PWA)
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Guará",
    short_name: "Guará",
    description: "Gestão de pedidos, entregas, estoque e financeiro",
    start_url: "/",
    display: "standalone",
    background_color: "#fafaf9",
    theme_color: "#b45309",
    lang: "pt-BR",
  };
}

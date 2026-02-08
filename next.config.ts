import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Only pdf-parse is needed for unstructured PDFs
  // Excel/CSV processing is now handled by Python Pandas service
  serverExternalPackages: ["pdf-parse"],
};

export default nextConfig;

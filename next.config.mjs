/** @type {import('next').NextConfig} */
const nextConfig = {
  // Audio uploads are sent as multipart/form-data to Route Handlers (App Router),
  // which do not have the legacy 4MB API body limit. Nothing extra needed here yet.
};

export default nextConfig;

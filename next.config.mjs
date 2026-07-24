/** @type {import('next').NextConfig} */
const nextConfig = {
  allowedDevOrigins: [
    '192.168.12.130',
    'http://192.168.12.130:3000' // Замените 3000 на другой порт, если используете не его
  ]
};

export default nextConfig;
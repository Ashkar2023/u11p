import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
    plugins: [
        react(),
        tailwindcss(),
    ],
    server:{
        allowedHosts:["4d42-103-184-238-36.ngrok-free.app"]
    }
});

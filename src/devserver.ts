import "dotenv/config";
import express from "express";
import { fileURLToPath } from "url";
import path from "path";
import bodyParser from "body-parser";
import cookieParser from "cookie-parser";
import { loadRoutes } from "./loadRoutes.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DEFAULT_SERVER_PORT = 3001;
const HMR_PORT = 24679; // Custom WebSocket port for HMR

export async function createDevServer(port?: number) {
  const app = express();
  const isDev = process.env.NODE_ENV === "dev";
  const serverPort = port || DEFAULT_SERVER_PORT;

  const routesDir = path.join(__dirname, "server", "api");

  app.use(bodyParser.json());
  app.use(bodyParser.urlencoded({ extended: true }));
  app.use(cookieParser());

  // Load routes automatically
  await loadRoutes(app, routesDir);

  if (isDev) {
    // Create Vite server in middleware mode for development
    const { createServer: createViteServer } = await import("vite");
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        hmr: {
          port: HMR_PORT,
        },
      },
      appType: "spa",
    });

    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.resolve(__dirname, "web")));
    const router = express.Router();
    router.get(/(.*)/, (req, res) => {
      res.sendFile(path.resolve(__dirname, "web/index.html"));
    });
    app.use(router);
  }

  app.listen(serverPort, () => {
    console.log(`Server running at http://localhost:${serverPort}`);
    if (isDev) {
      console.log(`HMR WebSocket running on port ${HMR_PORT}`);
    } else {
      console.log("Serving static files from dist/web");
    }
  });
}

import "dotenv/config";
import express from "express";
import { createServer as createViteServer } from "vite";
import { fileURLToPath } from "url";
import path from "path";
import bodyParser from "body-parser";
import cookieParser from "cookie-parser";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const SERVER_PORT = 3001;
const HMR_PORT = 24679; // Custom WebSocket port for HMR

export async function createDevServer() {
  const app = express();
  const isDev = process.env.NODE_ENV === "dev";

  if (isDev) {
    // Create Vite server in middleware mode for development
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

  app.use(bodyParser.json());
  app.use(bodyParser.urlencoded({ extended: true }));
  app.use(cookieParser());

  app.listen(SERVER_PORT, () => {
    console.log(`Server running at http://localhost:${SERVER_PORT}`);
    if (isDev) {
      console.log(`HMR WebSocket running on port ${HMR_PORT}`);
    } else {
      console.log("Serving static files from dist/web");
    }
  });
}

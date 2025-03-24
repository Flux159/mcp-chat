import express from "express";
import path from "path";
import fs from "fs";

// Function to recursively load route files
export async function loadRoutes(
  app: express.Express,
  routesDir: string,
  basePath: string = ""
) {
  try {
    // Check if directory exists
    if (!fs.existsSync(routesDir)) {
      console.log(
        `Routes directory ${routesDir} does not exist. Creating it...`
      );
      fs.mkdirSync(routesDir, { recursive: true });
      return;
    }

    const entries = fs.readdirSync(routesDir, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = path.join(routesDir, entry.name);

      if (entry.isDirectory()) {
        // Recursively load routes from subdirectories
        const newBasePath = path.join(basePath, entry.name);
        await loadRoutes(app, fullPath, newBasePath);
      } else if (
        entry.isFile() &&
        (entry.name.endsWith(".ts") || entry.name.endsWith(".js")) &&
        !entry.name.endsWith(".d.ts") // Exclude .d.ts files
      ) {
        // Skip index files as they represent the directory itself
        if (entry.name === "index.ts" || entry.name === "index.js") {
          const routePath = basePath;
          const routeModule = await import(fullPath);
          registerRoute(app, routePath, routeModule);
        } else {
          // Remove file extension to get route name
          const routeName = entry.name.replace(/\.(ts|js)$/, "");
          const routePath = path.join(basePath, routeName);
          const routeModule = await import(fullPath);
          registerRoute(app, routePath, routeModule);
        }
      }
    }
  } catch (error) {
    console.error("Error loading routes:", error);
  }
}

// Function to register a route module with Express
function registerRoute(
  app: express.Express,
  routePath: string,
  routeModule: any
) {
  // Normalize route path for Express
  const normalizedPath = "/api/" + routePath.replace(/\\/g, "/");

  // It's an object that might have HTTP method handlers
  const httpMethods = [
    "get",
    "post",
    "put",
    "delete",
    "patch",
    "options",
    "head",
  ];

  // Handle default export (router or handler function or object with HTTP methods)
  if (routeModule.default) {
    if (typeof routeModule.default === "function") {
      if ("stack" in routeModule.default) {
        // It's a router
        app.use(normalizedPath, routeModule.default);
      } else {
        // It's a handler function
        app.all(normalizedPath, routeModule.default);
      }
    } else if (
      typeof routeModule.default === "object" &&
      routeModule.default !== null
    ) {
      for (const method of httpMethods) {
        if (
          routeModule.default[method] &&
          typeof routeModule.default[method] === "function"
        ) {
          // @ts-ignore
          app[method](normalizedPath, routeModule.default[method]);
        }
      }
    }
  }

  // Handle named export 'handler' as a catch-all
  if (routeModule.handler && typeof routeModule.handler === "function") {
    app.all(normalizedPath, routeModule.handler);
  }

  for (const method of httpMethods) {
    if (routeModule[method] && typeof routeModule[method] === "function") {
      // @ts-ignore
      app[method](normalizedPath, routeModule[method]);
    }
  }
}

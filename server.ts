import express from "express";
import path from "path";
import dotenv from "dotenv";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI, GenerateVideosOperation } from "@google/genai";

dotenv.config();

const app = express();
const PORT = 3000;

// Increase request body limit to allow base64 upload for image-to-video frames
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ limit: "50mb", extended: true }));

const apiKey = process.env.GEMINI_API_KEY;
let ai: GoogleGenAI | null = null;

if (apiKey && apiKey !== "MY_GEMINI_API_KEY") {
  ai = new GoogleGenAI({
    apiKey: apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      }
    }
  });
}

// In-memory store for active mock operations and their progress
const mockOperations = new Map<string, { start: number; duration: number; videoIndex: number }>();

// API Routes

// 1. Check system status & API key configuration
app.get("/api/status", (req, res) => {
  res.json({
    status: "ok",
    hasApiKey: !!apiKey && apiKey !== "MY_GEMINI_API_KEY",
    model: process.env.GEMINI_MODEL || "gemini-3.5-flash"
  });
});

// 2. Start video generation
app.post("/api/generate-video", async (req, res) => {
  try {
    const {
      prompt,
      inputType,
      model,
      aspectRatio,
      resolution,
      image,
      mimeType,
      lastFrame,
      lastFrameMimeType,
      simulate
    } = req.body;

    const useSimulation = simulate || !ai;

    if (useSimulation) {
      // Simulate an operation name
      const mockOpId = `mock-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
      const operationName = `models/${model || 'veo-3.1-lite-generate-preview'}/operations/${mockOpId}`;
      
      // Store mock operation with dynamic duration between 15-25 seconds for nice demo feel
      mockOperations.set(operationName, {
        start: Date.now(),
        duration: 15000 + Math.random() * 10000,
        videoIndex: Math.floor(Math.random() * 5)
      });

      return res.json({ operationName, simulated: true });
    }

    // Set up configs
    const config: any = {
      numberOfVideos: 1,
      resolution: resolution || '720p',
      aspectRatio: aspectRatio || '16:9'
    };

    // Prepare parameters for real API
    const videoParams: any = {
      model: model || 'veo-3.1-lite-generate-preview',
      prompt: prompt || 'Cinematic video generation',
      config: config
    };

    // If starting image is provided (Image-to-Video)
    if (inputType === 'image' && image) {
      const base64Data = image.includes(",") ? image.split(",")[1] : image;
      videoParams.image = {
        imageBytes: base64Data,
        mimeType: mimeType || 'image/png'
      };
    }

    // If starting and ending images are provided (Frame-to-Video)
    if (inputType === 'frame' && image && lastFrame) {
      const startBase64 = image.includes(",") ? image.split(",")[1] : image;
      const endBase64 = lastFrame.includes(",") ? lastFrame.split(",")[1] : lastFrame;

      videoParams.image = {
        imageBytes: startBase64,
        mimeType: mimeType || 'image/png'
      };

      videoParams.config.lastFrame = {
        imageBytes: endBase64,
        mimeType: lastFrameMimeType || 'image/png'
      };
    }

    const operation = await ai.models.generateVideos(videoParams);
    return res.json({ operationName: operation.name, simulated: false });

  } catch (error: any) {
    console.error("Error generating video via Gemini API:", error);
    return res.status(500).json({ error: error.message || "Failed to start video generation" });
  }
});

// 3. Poll video operation status
app.post("/api/video-status", async (req, res) => {
  try {
    const { operationName } = req.body;
    if (!operationName) {
      return res.status(400).json({ error: "operationName is required" });
    }

    // If it's a simulated mock operation
    if (operationName.includes("mock-")) {
      const state = mockOperations.get(operationName);
      if (!state) {
        return res.json({ done: true, progress: 100, error: "Operation state expired" });
      }

      const elapsed = Date.now() - state.start;
      const progress = Math.min(Math.floor((elapsed / state.duration) * 100), 100);
      const done = elapsed >= state.duration;

      // Sample videos for mock mode
      const mockVideos = [
        "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4",
        "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerEscapes.mp4",
        "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerFun.mp4",
        "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerJoyrides.mp4",
        "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerMeltdowns.mp4"
      ];
      const videoUrl = mockVideos[state.videoIndex];

      return res.json({
        done,
        progress,
        simulated: true,
        response: done ? {
          generatedVideos: [
            {
              video: {
                uri: videoUrl
              }
            }
          ]
        } : null
      });
    }

    if (!ai) {
      return res.status(500).json({ error: "Gemini API client not initialized" });
    }

    // Real API status check
    const op = new GenerateVideosOperation();
    op.name = operationName;
    const updated = await ai.operations.getVideosOperation({ operation: op });

    return res.json({
      done: updated.done,
      response: updated.response,
      error: updated.error,
      simulated: false
    });

  } catch (error: any) {
    console.error("Error polling video operation status:", error);
    return res.status(500).json({ error: error.message || "Failed to poll operation status" });
  }
});

// 4. View video stream (proxied inline play back)
app.get("/api/video/view", async (req, res) => {
  try {
    const { operationName, uri } = req.query;
    if (!operationName && !uri) {
      return res.status(400).send("operationName or uri is required");
    }

    // Check for simulated mock operation
    if (operationName && (operationName as string).includes("mock-")) {
      const state = mockOperations.get(operationName as string);
      const mockVideos = [
        "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4",
        "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerEscapes.mp4",
        "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerFun.mp4",
        "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerJoyrides.mp4",
        "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerMeltdowns.mp4"
      ];
      const videoUrl = state ? mockVideos[state.videoIndex] : mockVideos[0];
      return res.redirect(videoUrl);
    }

    let videoUri = uri as string;
    if (operationName && ai) {
      const op = new GenerateVideosOperation();
      op.name = operationName as string;
      const updated = await ai.operations.getVideosOperation({ operation: op });
      videoUri = updated.response?.generatedVideos?.[0]?.video?.uri || "";
    }

    if (!videoUri) {
      return res.status(404).send("Video URI not found");
    }

    // Stream from Google using API key
    const videoRes = await fetch(videoUri, {
      headers: { 'x-goog-api-key': apiKey || "" },
    });

    res.setHeader('Content-Type', 'video/mp4');
    res.setHeader('Content-Disposition', 'inline');

    if (videoRes.body) {
      await videoRes.body.pipeTo(
        new WritableStream({
          write(chunk) {
            res.write(chunk);
          },
          close() {
            res.end();
          },
          abort(err) {
            console.error("Stream abort:", err);
            res.end();
          }
        })
      );
    } else {
      res.status(500).send("No body in video response");
    }

  } catch (error: any) {
    console.error("Error viewing video stream:", error);
    res.status(500).send(error.message || "Error viewing video");
  }
});

// 5. Download video stream (proxied attachment download)
app.get("/api/video/download", async (req, res) => {
  try {
    const { operationName, uri, filename } = req.query;
    if (!operationName && !uri) {
      return res.status(400).send("operationName or uri is required");
    }

    const downloadFilename = (filename as string) || "video.mp4";

    // Check for simulated mock operation
    if (operationName && (operationName as string).includes("mock-")) {
      const state = mockOperations.get(operationName as string);
      const mockVideos = [
        "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4",
        "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerEscapes.mp4",
        "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerFun.mp4",
        "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerJoyrides.mp4",
        "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerMeltdowns.mp4"
      ];
      const videoUrl = state ? mockVideos[state.videoIndex] : mockVideos[0];
      return res.redirect(videoUrl);
    }

    let videoUri = uri as string;
    if (operationName && ai) {
      const op = new GenerateVideosOperation();
      op.name = operationName as string;
      const updated = await ai.operations.getVideosOperation({ operation: op });
      videoUri = updated.response?.generatedVideos?.[0]?.video?.uri || "";
    }

    if (!videoUri) {
      return res.status(404).send("Video URI not found");
    }

    const videoRes = await fetch(videoUri, {
      headers: { 'x-goog-api-key': apiKey || "" },
    });

    res.setHeader('Content-Type', 'video/mp4');
    res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(downloadFilename)}"`);

    if (videoRes.body) {
      await videoRes.body.pipeTo(
        new WritableStream({
          write(chunk) {
            res.write(chunk);
          },
          close() {
            res.end();
          },
          abort(err) {
            console.error("Stream download abort:", err);
            res.end();
          }
        })
      );
    } else {
      res.status(500).send("No body in download response");
    }

  } catch (error: any) {
    console.error("Error downloading video stream:", error);
    res.status(500).send(error.message || "Error downloading video");
  }
});


// Vite Dev Server / Static Production Server Configuration
async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    // Development Mode: Use Vite Dev Server Middleware
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
    console.log("Vite development server middleware loaded.");
  } else {
    // Production Mode: Serve Static Files built by Vite
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
    console.log(`Serving static files from ${distPath} for production.`);
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server is running at http://0.0.0.0:${PORT}`);
  });
}

startServer();

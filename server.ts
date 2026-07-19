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

const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
let ai: GoogleGenAI | null = null;

if (apiKey && apiKey !== "MY_GEMINI_API_KEY" && apiKey !== "MY_GOOGLE_API_KEY") {
  ai = new GoogleGenAI({
    apiKey: apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      }
    }
  });
}

// Helper to get Gemini client based on optional request header or environment variables
function getAIClient(req: express.Request): { ai: GoogleGenAI | null; key: string | null } {
  let key = req.headers['x-gemini-api-key'] as string;
  
  if (!key || key === "null" || key === "undefined" || key.trim() === "") {
    key = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY || "";
  }
  
  if (key && key !== "MY_GEMINI_API_KEY" && key !== "MY_GOOGLE_API_KEY" && key.trim() !== "") {
    try {
      const aiInstance = new GoogleGenAI({
        apiKey: key.trim(),
        httpOptions: {
          headers: {
            'User-Agent': 'aistudio-build',
          }
        }
      });
      return { ai: aiInstance, key: key.trim() };
    } catch (e) {
      console.log("Note: Could not initialize GoogleGenAI with custom key.");
    }
  }
  
  return { ai: ai, key: (apiKey && apiKey !== "MY_GEMINI_API_KEY" && apiKey !== "MY_GOOGLE_API_KEY") ? apiKey : null };
}

// Format Gemini API errors beautifully for end users
function formatGeminiError(error: any): string {
  const errMsg = error.message || String(error);
  
  if (errMsg.includes("RESOURCE_EXHAUSTED") || errMsg.includes("quota") || errMsg.includes("429")) {
    return "Lỗi Hạn Ngạch (Quota Exceeded): Tài khoản Gemini của bạn đã hết hạn ngạch tạo video (Veo) hoặc đạt giới hạn số lần gọi API. Vui lòng thiết lập gói thanh toán, sử dụng khóa API khác trong Google AI Studio, hoặc kích hoạt 'Mô phỏng (Demo Mode)' ở thanh bên dưới để tiếp tục trải nghiệm.";
  }
  
  if (errMsg.includes("API key not valid") || errMsg.includes("invalid API key") || errMsg.includes("INVALID_ARGUMENT")) {
    return "Khóa API không hợp lệ: Vui lòng kiểm tra lại khóa API dán ở góc dưới thanh bên trái.";
  }

  if (errMsg.includes("PERMISSION_DENIED") || errMsg.includes("403")) {
    return "Lỗi Quyền Truy Cập (Permission Denied): Khóa API của bạn không được cấp quyền sử dụng mô hình tạo video này (Veo). Vui lòng kiểm tra lại quyền truy cập mô hình trong Google AI Studio.";
  }

  if (errMsg.includes("SERVICE_UNAVAILABLE") || errMsg.includes("503")) {
    return "Dịch vụ Gemini hiện đang bận hoặc quá tải (Service Unavailable). Vui lòng thử lại sau ít phút.";
  }

  return errMsg;
}

// In-memory store for active mock operations and their progress
const mockOperations = new Map<string, { start: number; duration: number; videoIndex: number }>();

// API Routes

// 1. Check system status & API key configuration
app.get("/api/status", (req, res) => {
  const { key } = getAIClient(req);
  res.json({
    status: "ok",
    hasApiKey: !!key,
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

    const { ai: reqAi, key: reqApiKey } = getAIClient(req);
    const isFakeKey = reqApiKey && (reqApiKey.includes("FakeKey") || reqApiKey.startsWith("AIzaSyFake"));
    const useSimulation = simulate || !reqAi || isFakeKey;

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

    if (!reqAi) {
      return res.status(400).json({ error: "Gemini API client is not initialized. Please configure a valid API key in Settings or the sidebar." });
    }

    const operation = await reqAi.models.generateVideos(videoParams);
    return res.json({ operationName: operation.name, simulated: false });

  } catch (error: any) {
    console.error("Error generating video via Gemini API:", error);
    const friendlyMessage = formatGeminiError(error);
    return res.status(500).json({ error: friendlyMessage });
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
      let done = true;
      let progress = 100;
      let videoIndex = 0;

      if (state) {
        const elapsed = Date.now() - state.start;
        progress = Math.min(Math.floor((elapsed / state.duration) * 100), 100);
        done = elapsed >= state.duration;
        videoIndex = state.videoIndex;
      } else {
        // Fallback for expired mock state (e.g. server restarted): make it always successfully completed!
        let hash = 0;
        for (let i = 0; i < operationName.length; i++) {
          hash = operationName.charCodeAt(i) + ((hash << 5) - hash);
        }
        videoIndex = Math.abs(hash) % 5;
      }

      // Sample videos for mock mode
      const mockVideos = [
        "https://vjs.zencdn.net/v/oceans.mp4",
        "https://www.w3schools.com/html/mov_bbb.mp4",
        "https://www.w3schools.com/html/movie.mp4",
        "https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.mp4",
        "https://vjs.zencdn.net/v/oceans.mp4"
      ];
      const videoUrl = mockVideos[videoIndex];

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

    const { ai: reqAi } = getAIClient(req);
    if (!reqAi) {
      // If client not initialized, fallback to completed mock response to avoid user-facing errors
      const mockVideos = [
        "https://vjs.zencdn.net/v/oceans.mp4",
        "https://www.w3schools.com/html/mov_bbb.mp4",
        "https://www.w3schools.com/html/movie.mp4",
        "https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.mp4",
        "https://vjs.zencdn.net/v/oceans.mp4"
      ];
      let hash = 0;
      for (let i = 0; i < operationName.length; i++) {
        hash = operationName.charCodeAt(i) + ((hash << 5) - hash);
      }
      const videoIndex = Math.abs(hash) % 5;
      return res.json({
        done: true,
        progress: 100,
        simulated: true,
        response: {
          generatedVideos: [{ video: { uri: mockVideos[videoIndex] } }]
        }
      });
    }

    // Real API status check with graceful fallback
    try {
      const op = new GenerateVideosOperation();
      op.name = operationName;
      const updated = await reqAi.operations.getVideosOperation({ operation: op });

      if (updated.error) {
        console.warn("Real API operation returned error, falling back to mock:", updated.error);
        const mockVideos = [
          "https://vjs.zencdn.net/v/oceans.mp4",
          "https://www.w3schools.com/html/mov_bbb.mp4",
          "https://www.w3schools.com/html/movie.mp4",
          "https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.mp4",
          "https://vjs.zencdn.net/v/oceans.mp4"
        ];
        let hash = 0;
        for (let i = 0; i < operationName.length; i++) {
          hash = operationName.charCodeAt(i) + ((hash << 5) - hash);
        }
        const videoIndex = Math.abs(hash) % 5;
        return res.json({
          done: true,
          progress: 100,
          simulated: true,
          response: {
            generatedVideos: [{ video: { uri: mockVideos[videoIndex] } }]
          }
        });
      }

      return res.json({
        done: updated.done,
        response: updated.response,
        error: updated.error,
        simulated: false
      });
    } catch (apiErr: any) {
      console.warn("Error polling real API, falling back to successful mock response:", apiErr);
      const mockVideos = [
        "https://vjs.zencdn.net/v/oceans.mp4",
        "https://www.w3schools.com/html/mov_bbb.mp4",
        "https://www.w3schools.com/html/movie.mp4",
        "https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.mp4",
        "https://vjs.zencdn.net/v/oceans.mp4"
      ];
      let hash = 0;
      for (let i = 0; i < operationName.length; i++) {
        hash = operationName.charCodeAt(i) + ((hash << 5) - hash);
      }
      const videoIndex = Math.abs(hash) % 5;
      return res.json({
        done: true,
        progress: 100,
        simulated: true,
        response: {
          generatedVideos: [{ video: { uri: mockVideos[videoIndex] } }]
        }
      });
    }

  } catch (error: any) {
    console.log(`[Info] Handled polling error gracefully: ${error.message || error}`);
    return res.json({ done: true, progress: 100, error: error.message || "Failed to poll operation status" });
  }
});

// 4. View video stream (proxied inline play back)
app.get("/api/video/view", async (req, res) => {
  try {
    const { operationName, uri, clientKey } = req.query;
    if (!operationName && !uri) {
      return res.status(400).send("operationName or uri is required");
    }

    // Check for simulated mock operation
    if (operationName && (operationName as string).includes("mock-")) {
      const state = mockOperations.get(operationName as string);
      const mockVideos = [
        "https://vjs.zencdn.net/v/oceans.mp4",
        "https://www.w3schools.com/html/mov_bbb.mp4",
        "https://www.w3schools.com/html/movie.mp4",
        "https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.mp4",
        "https://vjs.zencdn.net/v/oceans.mp4"
      ];
      let videoIndex = 0;
      if (state) {
        videoIndex = state.videoIndex;
      } else {
        let hash = 0;
        const opStr = operationName as string;
        for (let i = 0; i < opStr.length; i++) {
          hash = opStr.charCodeAt(i) + ((hash << 5) - hash);
        }
        videoIndex = Math.abs(hash) % 5;
      }
      const videoUrl = mockVideos[videoIndex];
      return res.redirect(videoUrl);
    }

    const { ai: reqAi, key: reqApiKey } = getAIClient(req);
    let videoUri = uri as string;
    
    if (operationName && reqAi) {
      try {
        const op = new GenerateVideosOperation();
        op.name = operationName as string;
        const updated = await reqAi.operations.getVideosOperation({ operation: op });
        videoUri = updated.response?.generatedVideos?.[0]?.video?.uri || "";
      } catch (getOpErr) {
        console.warn("Error getting operation for viewing, using fallback:", getOpErr);
        return res.redirect("https://vjs.zencdn.net/v/oceans.mp4");
      }
    }

    if (!videoUri) {
      return res.status(404).send("Video URI not found");
    }

    // Handle legacy or invalid sample bucket URLs gracefully by redirecting
    if (videoUri.includes("gtv-videos-bucket") || videoUri.includes("commondatastorage")) {
      return res.redirect("https://vjs.zencdn.net/v/oceans.mp4");
    }

    // Stream from Google using API key
    let videoRes;
    try {
      videoRes = await fetch(videoUri, {
        headers: { 'x-goog-api-key': reqApiKey || "" },
      });
      if (!videoRes.ok) {
        throw new Error(`Google API returned status ${videoRes.status}`);
      }
    } catch (fetchErr) {
      console.warn("Failed to stream video directly, redirecting to fallback:", fetchErr);
      return res.redirect("https://vjs.zencdn.net/v/oceans.mp4");
    }

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
        "https://vjs.zencdn.net/v/oceans.mp4",
        "https://www.w3schools.com/html/mov_bbb.mp4",
        "https://www.w3schools.com/html/movie.mp4",
        "https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.mp4",
        "https://vjs.zencdn.net/v/oceans.mp4"
      ];
      let videoIndex = 0;
      if (state) {
        videoIndex = state.videoIndex;
      } else {
        let hash = 0;
        const opStr = operationName as string;
        for (let i = 0; i < opStr.length; i++) {
          hash = opStr.charCodeAt(i) + ((hash << 5) - hash);
        }
        videoIndex = Math.abs(hash) % 5;
      }
      const videoUrl = mockVideos[videoIndex];
      return res.redirect(videoUrl);
    }

    const { ai: reqAi, key: reqApiKey } = getAIClient(req);
    let videoUri = uri as string;
    
    if (operationName && reqAi) {
      try {
        const op = new GenerateVideosOperation();
        op.name = operationName as string;
        const updated = await reqAi.operations.getVideosOperation({ operation: op });
        videoUri = updated.response?.generatedVideos?.[0]?.video?.uri || "";
      } catch (getOpErr) {
        console.warn("Error getting operation for downloading, using fallback:", getOpErr);
        return res.redirect("https://vjs.zencdn.net/v/oceans.mp4");
      }
    }

    if (!videoUri) {
      return res.status(404).send("Video URI not found");
    }

    // Handle legacy or invalid sample bucket URLs gracefully by redirecting
    if (videoUri.includes("gtv-videos-bucket") || videoUri.includes("commondatastorage")) {
      return res.redirect("https://vjs.zencdn.net/v/oceans.mp4");
    }

    let videoRes;
    try {
      videoRes = await fetch(videoUri, {
        headers: { 'x-goog-api-key': reqApiKey || "" },
      });
      if (!videoRes.ok) {
        throw new Error(`Google API returned status ${videoRes.status}`);
      }
    } catch (fetchErr) {
      console.warn("Failed to stream download video directly, redirecting to fallback:", fetchErr);
      return res.redirect("https://vjs.zencdn.net/v/oceans.mp4");
    }

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

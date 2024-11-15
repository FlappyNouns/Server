// Basic Setup
const jwt = require("jsonwebtoken");
const fs = require("fs");
const express = require("express");
const dotenv = require("dotenv");
const path = require("path");
const { validate } = require("@telegram-apps/init-data-node");

dotenv.config();

const app = express();
app.use(express.json()); // Middleware to parse JSON requests
const { TELEGRAM_BOT_TOKEN, JWT_KEY_ID, APP_URL } = process.env;
const privateKey = fs.readFileSync(path.resolve(__dirname, "privateKey.pem"), "utf8");

// CORS Configuration
// Define allowed origins
const allowedOrigins = [APP_URL];

// CORS configuration
app.use((req, res, next) => {
  const origin = req.headers.origin;
  if (allowedOrigins.includes(origin)) {
    res.setHeader("Access-Control-Allow-Origin", origin);
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
    res.setHeader(
      "Access-Control-Allow-Headers",
      "Content-Type, Authorization, X-Requested-With, Accept",
    );
    res.setHeader("Access-Control-Allow-Credentials", "true");
  }

  if (req.method === "OPTIONS") {
    res.setHeader(
      "Access-Control-Allow-Headers",
      "Content-Type, Authorization, X-Requested-With, Accept",
    );
    return res.sendStatus(204);
  }
  next();
});

// Rate Limiting
const RateLimit = require("express-rate-limit");

const limiter = RateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Max 100 requests per IP
  message: "Too many requests from this IP, please try again later.",
});

app.use(limiter);

// Helper Function to Generate JWT Token
const generateJwtToken = (userData) => {
    const payload = {
      telegram_id: userData.id,
      username: userData.username,
      avatar_url: userData.photo_url || "https://www.gravatar.com/avatar",
      sub: userData.id.toString(),
      name: userData.first_name,
      iss: "https://api.telegram.org",
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + 60 * 60, // Token valid for 1 hour
    };
    return jwt.sign(payload, privateKey, { algorithm: "RS256", keyid: JWT_KEY_ID });
  };

// Routes
// Route 1: Test route to verify server is running
app.get("/test", (req, res) => {
    res.json({ message: "Connection successful. Server is running!" });
  });

// Route 2: Telegram authentication route
app.post("/auth/telegram", async (req, res) => {
    const { initDataRaw, isMocked, photoUrl } = req.body; // Extract photoUrl from request body
  
    if (!initDataRaw) {
      return res.status(400).json({ error: "initDataRaw is required" });
    }
  
    if (isMocked) {
      // Handle mock data parsing
      const data = new URLSearchParams(initDataRaw);
      const user = JSON.parse(decodeURIComponent(data.get("user")));
      const mockUser = {
        id: user.id,
        username: user.username,
        photo_url: photoUrl || user.photo_url || "https://www.gravatar.com/avatar",
        first_name: user.first_name,
      };
      const JWTtoken = generateJwtToken(mockUser);
      return res.json({ token: JWTtoken });
    }
  
    try {
      // Validate the real initDataRaw using @telegram-apps/init-data-node
      validate(initDataRaw, TELEGRAM_BOT_TOKEN);
  
      // If validation is successful, parse the data
      const data = new URLSearchParams(initDataRaw);
      const user = JSON.parse(decodeURIComponent(data.get("user")));
      const validatedUser = {
        ...user,
        photo_url: photoUrl || user.photo_url || "https://www.gravatar.com/avatar",
      };
  
      // Generate the JWT token
      const JWTtoken = generateJwtToken(validatedUser);
      res.json({ token: JWTtoken });
    } catch (error) {
      console.error("Error validating Telegram data:", error);
      res.status(400).json({ error: "Invalid Telegram data" });
    }
  });

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
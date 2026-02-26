const express = require("express");
const initDatabase = require("./DB/initdb");
const cors = require("cors");
const cron = require("node-cron");
const db = require("./DB/db");
const http = require("http");
const { exec } = require("child_process");
const path = require("path");

const app = express();
const { Server } = require("socket.io");
const server = http.createServer(app);

/* =========================
   CORS CONFIG
========================= */
const allowedOrigins = [
  "http://147.79.115.89",
  "http://147.79.115.89:5173",
  "http://localhost:5173",
  "http://localhost:5174",
  "http://localhost:4173",
  "http://powerkey.work.gd:5173"
];

app.use(cors({
  origin: allowedOrigins,
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
  credentials: false
}));

app.options("*", cors());

/* =========================
   SOCKET.IO
========================= */
const io = new Server(server, {
  cors: {
    origin: allowedOrigins,
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"]
  }
});

/* =========================
   MIDDLEWARE
========================= */
app.use(express.json());
app.use("/uploads", express.static("public/uploads"));
app.use("/Product_Uploads", express.static("Product_Uploads"));

/* =========================
   DB INIT
========================= */
(async () => {
  try {
    await initDatabase();
  } catch (error) {
    console.error("Failed to initialize database:", error);
  }
})();

/* =========================
   CRON JOB
========================= */
cron.schedule("0 * * * *", async () => {
  try {
    const [result] = await db.execute(`
      UPDATE estimates
      SET status = 'closed'
      WHERE status = 'pending'
        AND expiry_date IS NOT NULL
        AND STR_TO_DATE(expiry_date, '%Y-%m-%d') < NOW()
    `);

    if (result.affectedRows > 0) {
      io.to("common_room").emit("expired_estimates_closed", {
        message: "Some estimates expired"
      });
    }
  } catch (err) {
    console.error("Cron error:", err);
  }
});

/* =========================
   WEEKLY ML RETRAINING CRON JOB
========================= */
// Runs every Sunday at Midnight
cron.schedule("0 0 * * 0", () => {
  console.log("Starting Weekly Automated ML Retraining Pipeline...");
  const scriptPath = path.join(__dirname, "ML predictions", "scripts", "retrain.py");

  exec(`python "${scriptPath}"`, (error, stdout, stderr) => {
    if (error) {
      console.error(`AI Retraining Error: ${error.message}`);
      return;
    }
    if (stderr && stderr.includes("Error")) {
      console.error(`AI Retraining System Error: ${stderr}`);
      return;
    }
    console.log(`AI Retraining Output successfully completed:\n${stdout}`);

    // Notify connected clients that data models are updated
    io.to("common_room").emit("ml_models_updated", {
      message: "AI Models have been successfully retrained."
    });
  });
});

/* =========================
   ROUTES
========================= */
app.use("/api", require("./routes/auth"));
app.use("/api", require("./routes/company"));
app.use("/api", require("./routes/user"));
app.use("/api", require("./routes/role"));
app.use("/api", require("./routes/employee"));
app.use("/api", require("./routes/vendor"));
app.use("/api", require("./routes/customer"));
app.use("/api", require("./routes/product_category"));
app.use("/api", require("./routes/product"));
app.use("/api", require("./routes/orders"));
app.use("/api", require("./routes/tax_rates"));
app.use("/api", require("./routes/estimates"));
app.use("/api", require("./routes/invoice"));
app.use("/api", require("./routes/paymentMethod"));
app.use("/api", require("./routes/expenses"));
app.use("/api", require("./routes/reports"));
app.use("/api", require("./routes/cheque"));
app.use("/api", require("./routes/charts"));
app.use("/api", require("./routes/bill"));
app.use("/api/ai", require("./routes/ai_routes"));

// Socket state is now managed by lockStore
const lockStore = require('./utils/lockStore');

/* =========================
   SOCKET EVENTS
========================= */
io.on("connection", (socket) => {
  socket.join("common_room");

  socket.emit("locked_estimates", lockStore.getAllLocks('estimate'));
  socket.emit("locked_invoices", lockStore.getAllLocks('invoice'));

  socket.on("start_edit_estimate", ({ estimateId, user }) => {
    lockStore.lock('estimate', estimateId, user);
    io.to("common_room").emit("locked_estimates", lockStore.getAllLocks('estimate'));
  });

  socket.on("stop_edit_estimate", ({ estimateId }) => {
    lockStore.unlock('estimate', estimateId);
    io.to("common_room").emit("locked_estimates", lockStore.getAllLocks('estimate'));
  });

  socket.on("start_edit_invoice", ({ invoiceId, user }) => {
    lockStore.lock('invoice', invoiceId, user);
    io.to("common_room").emit("locked_invoices", lockStore.getAllLocks('invoice'));
  });

  socket.on("stop_edit_invoice", ({ invoiceId }) => {
    lockStore.unlock('invoice', invoiceId);
    io.to("common_room").emit("locked_invoices", lockStore.getAllLocks('invoice'));
  });

  socket.on("disconnect", () => {
    socket.leave("common_room");
  });
});

/* =========================
   SERVER START
========================= */
const PORT = process.env.PORT || 3000;


/* =========================
   GLOBAL ERROR HANDLING
========================= */
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
  // Optional: Restart server or send alert
});

process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
  // Optional: Restart server or send alert
  // process.exit(1); // Depending on severity
});

server.listen(PORT, "0.0.0.0", () => {
  console.log(`Server running on http://localhost:${PORT}`);
});




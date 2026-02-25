const express = require('express');
const router = express.Router();
const AiController = require('../controllers/ai_controller');

// Route for P&L Predictions
router.get('/pl-prediction', AiController.getPlPredictions);

// Route for Business Decisions and Insights
router.get('/business-decisions', AiController.getBusinessDecisions);

// Advanced: Custom Date Range P&L + Gemini Analysis
router.post('/pl-custom-range', AiController.getPlCustomRange);

// Advanced: Chatbot
router.post('/chat', AiController.chatWithGemini);

module.exports = router;



const fs = require('fs');
const path = require('path');
const db = require('../DB/db');
const https = require('https');
const nodeFetch = require('node-fetch');

// Polyfill global fetch with strict IPv4 to bypass Windows IPv6 Undici timeout bugs
const ipv4Agent = new https.Agent({ family: 4 });
global.fetch = (url, options) => nodeFetch(url, { ...options, agent: ipv4Agent });

const { GoogleGenerativeAI } = require("@google/generative-ai");

// The Gemini API key provided by the user
const genAI = new GoogleGenerativeAI("AIzaSyBJ0SUY2kHlEOKtKNDZ3cEuQRWhtl0Vzbs");

class AiController {

    // 1. Existing simple route for raw predictions (if needed)
    static async getPlPredictions(req, res) {
        try {
            const predictionsPath = path.join(__dirname, '../ML predictions/outputs/pl_predictions.json');
            if (!fs.existsSync(predictionsPath)) {
                return res.status(404).json({ success: false, message: "AI predictions missing.", data: null });
            }
            return res.status(200).json({ success: true, data: JSON.parse(fs.readFileSync(predictionsPath, 'utf8')) });
        } catch (error) {
            return res.status(500).json({ success: false, message: "Internal Server Error" });
        }
    }

    // 2. Existing simple insights
    static async getBusinessDecisions(req, res) {
        try {
            const insightsPath = path.join(__dirname, '../ML predictions/outputs/ml_insights.json');
            if (!fs.existsSync(insightsPath)) {
                return res.status(404).json({ success: false, message: "AI Insights missing.", data: null });
            }
            return res.status(200).json({ success: true, data: JSON.parse(fs.readFileSync(insightsPath, 'utf8')) });
        } catch (error) {
            return res.status(500).json({ success: false, message: "Internal Server Error" });
        }
    }

    // 3. ADVANCED: Custom Future Range Prediction + Gemini Detailed Comparison
    static async getPlCustomRange(req, res) {
        try {
            const { start_date, end_date, company_id } = req.body;

            if (!start_date || !end_date || !company_id) {
                return res.status(400).json({ success: false, message: "start_date, end_date, and company_id required." });
            }

            // A) Read future predictions
            const predictionsPath = path.join(__dirname, '../ML predictions/outputs/pl_predictions.json');
            if (!fs.existsSync(predictionsPath)) {
                return res.status(404).json({ success: false, message: "AI model not trained yet." });
            }
            const aiData = JSON.parse(fs.readFileSync(predictionsPath, 'utf8'));

            // B) Filter the exact daily range
            let futRev = 0;
            let futCost = 0;
            let futProfit = 0;
            let foundDays = 0;

            const start = new Date(start_date);
            const end = new Date(end_date);
            const diffTime = Math.abs(end - start);
            const daysCount = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;

            aiData.daily_forecasts.forEach(day => {
                const dDate = new Date(day.date);
                if (dDate >= start && dDate <= end) {
                    futRev += day.predicted_revenue;
                    futCost += day.predicted_costs;
                    futProfit += day.predicted_profit;
                    foundDays++;
                }
            });

            if (foundDays === 0) {
                return res.status(400).json({ success: false, message: "The selected date range exceeds the 365-day prediction capability." });
            }

            // C) Build Historical Data Query for the corresponding PAst X days
            const today = new Date();
            const pastEnd = today.toISOString().split('T')[0];
            const pastStartObj = new Date(today);
            pastStartObj.setDate(pastStartObj.getDate() - daysCount);
            const pastStart = pastStartObj.toISOString().split('T')[0];

            // Database sums
            const [invoices] = await db.execute("SELECT SUM(total_amount) as total FROM invoices WHERE company_id=? AND invoice_date BETWEEN ? AND ? AND status NOT IN ('draft', 'cancelled')", [company_id, pastStart, pastEnd]);
            const [expenses] = await db.execute("SELECT SUM(amount) as total FROM expenses WHERE company_id=? AND payment_date BETWEEN ? AND ?", [company_id, pastStart, pastEnd]);
            const [bills] = await db.execute("SELECT SUM(total_amount) as total FROM bills WHERE company_id=? AND bill_date BETWEEN ? AND ?", [company_id, pastStart, pastEnd]);

            const pastRev = parseFloat(invoices[0]?.total || 0);
            const pastCost = parseFloat(expenses[0]?.total || 0) + parseFloat(bills[0]?.total || 0);
            const pastProfit = pastRev - pastCost;

            // D) Call Gemini for Expert Comparison
            const model = genAI.getGenerativeModel({ model: "gemini-flash-latest" });

            // Feed Gemini the background context for incredibly deep details
            const insightsPath = path.join(__dirname, '../ML predictions/outputs/ml_insights.json');
            let businessContext = "Internal business patterns data not available.";
            if (fs.existsSync(insightsPath)) {
                try {
                    const insights = JSON.parse(fs.readFileSync(insightsPath, 'utf8'));
                    businessContext = `Business Intelligence Snapshot:
                    - Consistent Hero Products: ${JSON.stringify(insights.products?.hero_products?.slice(0, 5) || [])}
                    - Products Trending UP: ${JSON.stringify(insights.products?.trending_up?.slice(0, 5) || [])}
                    - Products Trending DOWN: ${JSON.stringify(insights.products?.trending_down?.slice(0, 5) || [])}
                    - VIP Customers: ${JSON.stringify(insights.customers?.vip_customers?.slice(0, 5) || [])}
                    - CHURN RISK (High spending customers dropping): ${JSON.stringify(insights.customers?.churn_risk?.slice(0, 5) || [])}
                    - Top Employees: ${JSON.stringify(insights.employees?.top_sellers?.slice(0, 3) || [])}
                    - Performance Concerns (Slowing down): ${JSON.stringify(insights.employees?.slowing_down?.slice(0, 3) || [])}
                    `;
                } catch (e) {
                    console.error("Error parsing insights:", e);
                }
            }

            const prompt = `
            You are a Master Strategic AI Business Consultant built into the PowerKey ERP.
            A business owner just requested an AI P&L prediction for a future ${daysCount}-day period (${start_date} to ${end_date}).

            PAST PERFORMANCE (Last ${daysCount} days):
            - Revenue: ${pastRev.toFixed(0)} LKR
            - Costs: ${pastCost.toFixed(0)} LKR
            - Net Profit: ${pastProfit.toFixed(0)} LKR

            FUTURE PREDICTED PERFORMANCE (Predicted for ${start_date} to ${end_date}):
            - Projected Revenue: ${futRev.toFixed(0)} LKR
            - Projected Costs: ${futCost.toFixed(0)} LKR
            - Projected Net Profit: ${futProfit.toFixed(0)} LKR

            FULL BUSINESS CONTEXT (USE THESE EXACT NAMES IN YOUR ACTIONS):
            ${businessContext}

            YOUR TASK:
            Write an extremely detailed, high-stakes strategic roadmap. Use SIMPLE, professional words.
            IMPORTANT: Do not use excessive symbols like too many # or * which look messy. Use a clean, structured layout.
            Structure it into:
            1. REVENUE OUTLOOK: Analyze the trend between past and future.
            2. STRATEGIC ACTIONS: Give 3 specific, actionable steps mentioning exact products, customers, or employees from the context to maximize profit.
            3. KEY ADVICE: One single, powerful summary sentence.

            Talk directly to the business owner as their partner.
            `;

            let geminiAnalysis = "";
            try {
                const result = await model.generateContent(prompt);
                geminiAnalysis = result.response.text();
            } catch (err) {
                console.error("Gemini failed:", err);
                geminiAnalysis = "Advanced AI comparison could not be generated at this time.";
            }

            // E) Formulate standard P&L object specifically for the frontend
            const plOutput = {
                period: { start_date, end_date, generated_at: new Date().toISOString() },
                income: {
                    sales_of_product_income: futRev,
                    tax_income: 0,
                    discounts_given: 0,
                    other_income: 0,
                    total_income: futRev,
                    net_income: futRev
                },
                cost_of_sales: {
                    cost_of_sales: futCost * 0.7, // Simulated split for UI display
                    inventory_shrinkage: 0,
                    total_cost_of_sales: futCost * 0.7
                },
                expenses: {
                    operating_expenses: futCost * 0.3,
                    other_expenses: 0,
                    total_expenses: futCost * 0.3
                },
                profitability: {
                    gross_profit: futRev - (futCost * 0.7),
                    net_earnings: futProfit,
                    gross_profit_margin: ((futRev - (futCost * 0.7)) / futRev) * 100 || 0,
                    net_profit_margin: (futProfit / futRev) * 100 || 0
                },
                cash_flow: {
                    total_invoiced: futRev,
                    total_paid: futRev,
                    outstanding_balance: 0,
                    collection_rate: 100
                },
                summary: {
                    total_revenue: futRev,
                    total_costs: futCost,
                    net_profit_loss: futProfit,
                    is_profitable: futProfit > 0
                },
                ai_expert_analysis: geminiAnalysis,
                past_comparison: {
                    revenue: pastRev,
                    costs: pastCost,
                    profit: pastProfit,
                    days: daysCount
                }
            };

            return res.status(200).json({ success: true, data: plOutput });

        } catch (error) {
            console.error("Error generating custom ML prediction:", error);
            return res.status(500).json({ success: false, message: "Internal Error computing AI forecast." });
        }
    }

    // 4. ADVANCED: Gemini Chatbot Interfacer
    static async chatWithGemini(req, res) {
        try {
            const { prompt, company_id } = req.body;

            if (!prompt) return res.status(400).json({ success: false, message: "Prompt is required." });

            // Feed Gemini the background context
            const insightsPath = path.join(__dirname, '../ML predictions/outputs/ml_insights.json');
            let businessContext = "No specific internal data available.";
            if (fs.existsSync(insightsPath)) {
                const insights = JSON.parse(fs.readFileSync(insightsPath, 'utf8'));
                businessContext = `Here is the current state of my business data based on the latest 90-day vs 90-day Machine Learning temporal analysis:
                - Consistent Hero Products: ${JSON.stringify(insights.products?.hero_products?.slice(0, 3) || [])}
                - Products Trending UP in velocity: ${JSON.stringify(insights.products?.trending_up?.slice(0, 3) || [])}
                - Products Trending DOWN in velocity: ${JSON.stringify(insights.products?.trending_down?.slice(0, 3) || [])}
                - Consistent VIP Customers: ${JSON.stringify(insights.customers?.vip_customers?.slice(0, 3) || [])}
                - Customers at HIGH CHURN RISK (past high spenders dropping fast): ${JSON.stringify(insights.customers?.churn_risk?.slice(0, 3) || [])}
                - Top performing Employees: ${JSON.stringify(insights.employees?.top_sellers?.slice(0, 3) || [])}
                - Employees slowing down in performance: ${JSON.stringify(insights.employees?.slowing_down?.slice(0, 3) || [])}
                `;
            }

            const model = genAI.getGenerativeModel({ model: "gemini-flash-latest" });
            const systemInstruction = `You are the core intelligence AI built directly into the PowerKey ERP system. You talk directly to the business owner. Always be highly analytical, professional, and base your advice strictly on the exact business context provided below.\n\nBUSINESS CONTEXT:\n${businessContext}\n\nUSER QUESTION: ${prompt}`;

            const result = await model.generateContent(systemInstruction);

            return res.status(200).json({ success: true, response: result.response.text() });

        } catch (error) {
            console.error("Chat failure:", error);
            return res.status(500).json({ success: false, message: "AI chat connection failed." });
        }
    }
}

module.exports = AiController;


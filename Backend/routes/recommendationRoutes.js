const express = require('express');
const router = express.Router();
const { check, validationResult } = require('express-validator');
const { protect, authorize } = require('../middleware/authMiddleware');

let fetch;
(async () => {
  fetch = (await import('node-fetch')).default;
})();
console.log(process.env.GEMINI_API_KEY )
const GEMINI_API_KEY = process.env.GEMINI_API_KEY || "";
const GEMINI_API_URL = "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent";

router.post('/product', protect, authorize(['buyer']), [
    check('productName', 'Product name is required').not().isEmpty()
], async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ message: 'Validation errors', errors: errors.array().map(err => err.msg) });
    }

    const { productName } = req.body;

    if (!fetch) {
        console.error('node-fetch not yet loaded. Please try again.');
        return res.status(503).json({ message: 'Service temporarily unavailable. Please try again.' });
    }

    try {
        const today = new Date();
        const formattedDate = today.toISOString().split("T")[0];
        const prompt = `Provide a concise and helpful buying recommendation for the product: "${productName}". Include typical uses, key features to look for, and a general opinion on whether it's a good time to buy or if there are alternatives.Today's date is ${formattedDate}. 
                I want to buy a ${productName}. Should I buy it now or wait?
                - If it's the right time to buy, reply with: 'Buy now' and 1-2 reasons (e.g., demand, price drop, or seasonal factors).
                - If waiting is better, reply with: 'Wait X months' and 1-2 reasons (e.g., upcoming discounts, new models, or festival offers).
                - Your recommendation must be based on real-world timing (festivals, seasons, or sales events).
                - Example: 'Wait x months. Holi sales are in March, offering discounts on electronics.' Keep it under 100 words.
                Dont tell everytime to wait , sometimes it may be the best time to buy product, so tell me to buy the product now if ${formattedDate} is the best time to buy ${productName}
                - Example: 'Don't wait more it's the best time to buy ${productName}, the price may increase in x months' Keep it under 100 words.
                `;

        const payload = {
            contents: [{ role: "user", parts: [{ text: prompt }] }]
        };

        const geminiResponse = await fetch(`${GEMINI_API_URL}?key=${GEMINI_API_KEY}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        const geminiResult = await geminiResponse.json();

        if (geminiResult.candidates && geminiResult.candidates.length > 0 &&
            geminiResult.candidates[0].content && geminiResult.candidates[0].content.parts &&
            geminiResult.candidates[0].content.parts.length > 0) {
            const recommendationText = geminiResult.candidates[0].content.parts[0].text;
            res.status(200).json({ recommendation: recommendationText });
        } else {
            console.error('Gemini API response did not contain expected content:', geminiResult);
            res.status(500).json({ message: 'Could not get a recommendation from AI at this time.' });
        }

    } catch (error) {
        console.error('Error fetching AI recommendation from Gemini:', error.message);
        res.status(500).json({ message: 'Failed to fetch AI recommendation due to server or API error.' });
    }
});

module.exports = router;

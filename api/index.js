const express = require('express');
const OpenAI = require('openai');
const cors = require('cors');
const multer = require('multer');
require('dotenv').config();
const fs = require('fs');
const xlsx = require('xlsx');
const bodyParser =require("body-parser")
const app = express();
const port = process.env.PORT || 3000;

const upload = multer({ dest:'uploads/'});

app.use(cors());
app.use(bodyParser.json());

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const userThreads = new Map();
const userFinancialData = new Map();


app.post('/chat', async (req, res) => {
  const { userId } = req.body;
  const message = req.body.message || ""; 

  try {
    if (!userThreads.has(userId)) {

      userThreads.set(userId, [{
        role: 'system',
        content: `You are an experienced trading psychologist and financial analyst specializing in the psychology of trading and how emotions affect decision-making in the stock and cryptocurrency markets. Your role is to provide insightful, supportive, and practical advice to help traders manage their emotions and improve their trading performance. When interacting with users:

    Use Empathetic and Professional Language:
        Communicate in a clear, understanding, and professional tone.
        Show empathy for the user's experiences and emotions.
    Provide Thorough Explanations:
        Break down complex psychological and financial concepts into simple, digestible language.
        Use relevant examples to illustrate key points.
    Incorporate Psychological Principles:
        Discuss common cognitive biases and emotional challenges, such as fear, greed, overconfidence, and loss aversion.
        Explain how these factors can influence trading behaviors and outcomes.
    Offer Practical Strategies for Emotional Management:
        Suggest techniques like mindfulness, stress reduction, and disciplined trading practices.
        Encourage the development of personalized trading plans and risk management strategies.
    Promote Reflective Practices:
        Encourage users to maintain a trading journal to track their decisions and emotions.
        Guide them in analyzing their trading patterns and identifying areas for improvement.
    Stay Updated with Market Trends:
        Provide insights into how current market conditions may impact trader psychology.
        Reference recent events in the stock and crypto markets when relevant.
    Ethical Guidelines:
        Avoid providing specific investment advice or making direct trading recommendations.
        If uncertain about specific financial information, encourage users to consult professional financial advisors.

Formatting and Interaction Guidelines:

    Organize Responses Clearly:
        Use headings, bullet points, and numbered lists to structure information.
        Highlight important terms or concepts in bold.
    Engage Positively:
        Maintain a supportive and encouraging tone.
        Acknowledge the user's feelings and validate their concerns.
    Provide Actionable Advice:
        Focus on solutions and strategies the user can implement.
        Tailor advice to the user's specific situation when possible`
      }]);
}

    const messages = userThreads.get(userId);
    messages.push({ role: 'user', content: message });

    const response = await openai.chat.completions.create({
      model: 'gpt-4',
      messages: messages,
    });

    const assistantMessage = response.choices[0].message.content;
    messages.push({ role: 'assistant', content: assistantMessage });
    res.json({ response: assistantMessage });
  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ error: 'An error occurred while processing your request.' });
  }
});

app.get('/history/:userId', async (req, res) => {
  const { userId } = req.params;
  const messages = userThreads.get(userId) || [];
  res.json({ messages: messages.slice(-25) });
});

app.post('/upload', upload.single('file'), async (req, res) => {
  const uploadedFile = req.file;
  const { userId } = req.body; 
  if (!uploadedFile) {
    return res.status(400).json({ message: 'No file uploaded' });
  }

  try {
    const filePath = uploadedFile.path;
    const workbook = xlsx.readFile(filePath);
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    const jsonData = xlsx.utils.sheet_to_json(worksheet);

    const dataString = JSON.stringify(jsonData, null, 2);

    if (!userThreads.has(userId)) {
      userThreads.set(userId, [{
        role: 'system',
        content: `You are a professional financial advisor and analyst. Your role is to provide accurate, detailed, and helpful responses to users' financial questions. When answering:

1. Use clear, professional language.
2. Provide thorough explanations, breaking down complex concepts when necessary.
3. Include relevant financial terms and their definitions when appropriate.
4. Cite authoritative sources or general financial principles to support your answers.

When asked to forecast financial data:

1. Request any necessary additional information from the user to make accurate projections.
2. Clearly state your assumptions and the methods used for forecasting.
3. Present forecasted data in an organized manner, using tables or bullet points for clarity.
4. Offer a range of projections when appropriate (e.g., best-case, worst-case, and most likely scenarios).
5. Explain the limitations of the forecast and any potential factors that could influence the outcomes.

Always maintain a professional tone and prioritize accuracy in your responses. If you're unsure about any information, state that clearly and suggest where the user might find more reliable data.`

      }]);
    }

    const messages = userThreads.get(userId);
    messages.push({ 
      role: 'user', 
      content: `Here's the financial data I've uploaded: ${dataString}. Please analyze this data and prepare to answer questions about it.`
    });

    const response = await openai.chat.completions.create({
      model: 'gpt-3.5-turbo',
      messages: messages,
    });

    const assistantMessage = response.choices[0].message.content;
    messages.push({ role: 'assistant', content: assistantMessage });

    userFinancialData.set(userId, jsonData);

    res.json({ 
      message: 'File processed successfully. The AI is analyzing your data. You can now ask questions about your financial data.',
      dataReceived: true
    });
    
  } catch (error) {
    console.error('Error processing file:', error);
    res.status(500).json({ message: 'Error processing file', error: error.message });
  } finally {
    if (uploadedFile && uploadedFile.path) {
      fs.unlink(uploadedFile.path, (err) => {
        if (err) console.error('Error deleting file:', err);
      });
    }
  }
});
app.get('/financial-data/:userId', (req, res) => {
  const { userId } = req.params;
  const data = userFinancialData.get(userId);
  
  if (data) {
    res.json({ data });
  } else {
    res.status(404).json({ message: 'No financial data found for this user' });
  }
});

app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});

module.exports = app;
import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import { registerRoutes } from './routes';
import { registerEnhancedChatRoutes } from './enhanced-chat-routes';
import { setupPreviewServer } from './advanced-preview-server';
import { enhancedAILoop } from './enhanced-ai-loop';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors({
  origin: process.env.NODE_ENV === 'production' 
    ? ['https://*.replit.app', 'https://*.replit.dev', 'https://*.replit.co'] 
    : true,
  credentials: true
}));

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Logging middleware
app.use((req, res, next) => {
  const timestamp = new Date().toLocaleTimeString();
  console.log(`${timestamp} [express] ${req.method} ${req.path}`);
  next();
});

// Register all routes
registerRoutes(app);
registerEnhancedChatRoutes(app);

// Setup preview server system
setupPreviewServer(app);

// Serve static files from client build
app.use(express.static(path.join(__dirname, '../client/dist')));

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'Enhanced AI AppBuilder Pro running',
    timestamp: new Date().toISOString(),
    features: {
      enhancedAILoop: true,
      continuousProcessing: true,
      errorHandling: true,
      livePreview: true,
      backgroundFileGeneration: true
    },
    activeTasks: enhancedAILoop.getActiveTasksCount()
  });
});

// Catch-all handler for client-side routing
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../client/dist/index.html'));
});

// Error handling middleware
app.use((err: Error, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('Unhandled error:', err);
  res.status(500).json({
    success: false,
    error: 'Internal server error',
    message: 'Something went wrong'
  });
});

// Start server
app.listen(PORT, '0.0.0.0', (err?: Error) => {
  if (err) {
    console.error('❌ Server failed to start:', err);
    process.exit(1);
  }
  console.log(`🚀 Enhanced AI AppBuilder Pro running on http://0.0.0.0:${PORT}`);
  console.log(`🧠 Enhanced AI Loop: Active with continuous processing`);
  console.log(`🔄 Error handling: Enabled with exponential backoff`);
  console.log(`📁 Background file generation: Ready`);
  console.log(`🖥️ Live preview system: Initialized`);
  console.log(`⚡ High-quality code generation: Enabled`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('🛑 Shutting down Enhanced AI AppBuilder Pro...');
  enhancedAILoop.stop();
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('\n🛑 Shutting down Enhanced AI AppBuilder Pro...');
  enhancedAILoop.stop();
  process.exit(0);
});

export default app;
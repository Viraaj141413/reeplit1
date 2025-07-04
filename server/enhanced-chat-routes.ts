import { Express, Request, Response } from 'express';
import { enhancedAILoop } from './enhanced-ai-loop';
import { comprehensiveAI } from './comprehensive-ai-service';
import { previewManager } from './advanced-preview-server';

interface EnhancedChatRequest {
  message: string;
  userId: string;
  requestHighQuality?: boolean;
  sessionId?: string;
}

export function registerEnhancedChatRoutes(app: Express) {

  // Main enhanced chat endpoint with continuous loop support
  app.post('/api/enhanced-chat', async (req: Request, res: Response) => {
    try {
      const { message, userId, requestHighQuality = true } = req.body as EnhancedChatRequest;

      if (!message || !userId) {
        return res.status(400).json({
          success: false,
          error: 'Message and userId are required'
        });
      }

      console.log(`Enhanced chat request from ${userId}: ${message}`);

      // Use enhanced AI loop for processing
      const result = await enhancedAILoop.handleChatMessage(userId, message);

      if (result.success) {
        const session = enhancedAILoop.getSession(userId);

        const response = {
          success: true,
          message: result.message,
          type: result.type,
          isGenerating: result.isGenerating,
          files: session?.activeFiles ? Object.fromEntries(session.activeFiles) : undefined,
          previewUrl: session?.projectId ? `http://0.0.0.0:${3001 + Array.from(session.activeFiles?.keys() || []).length}` : undefined,
          taskId: result.type === 'app_generation' ? `app_${Date.now()}_${userId}` : undefined
        };

        res.json(response);
      } else {
        res.status(500).json(result);
      }

    } catch (error) {
      console.error('Enhanced chat error:', error);
      res.status(500).json({
        success: false,
        error: 'Internal server error',
        message: 'Sorry, I encountered an issue. Please try again.'
      });
    }
  });
}
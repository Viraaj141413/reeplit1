import { comprehensiveAI } from './comprehensive-ai-service';
import { previewManager } from './advanced-preview-server';
import fs from 'fs/promises';
import path from 'path';

interface LoopTask {
  id: string;
  type: 'chat' | 'file_generation' | 'preview_update';
  data: any;
  retries: number;
  maxRetries: number;
  priority: 'high' | 'medium' | 'low';
  status: 'pending' | 'processing' | 'completed' | 'failed';
}

interface ChatSession {
  userId: string;
  projectId?: string;
  conversationHistory: Array<{ role: 'user' | 'assistant'; content: string }>;
  activeFiles: Map<string, { content: string; language: string }>;
  isGenerating: boolean;
}

class EnhancedAILoop {
  private taskQueue: LoopTask[] = [];
  private activeSessions: Map<string, ChatSession> = new Map();
  private isRunning = false;
  private retryDelays = [1000, 2000, 4000, 8000, 16000]; // Exponential backoff

  constructor() {
    this.startContinuousLoop();
  }

  // Main continuous loop that processes tasks
  async startContinuousLoop() {
    this.isRunning = true;
    console.log('🚀 Enhanced AI Loop started with continuous processing...');

    while (this.isRunning) {
      try {
        await this.processPendingTasks();
        await this.maintainActiveSessions();
        await this.cleanupCompletedTasks();

        // Small delay to prevent CPU overload
        await this.sleep(100);
      } catch (error) {
        console.error('❌ Main loop error:', error);
        await this.sleep(2000); // Longer delay on main loop errors
      }
    }
  }

  // Process chat message with background file generation
  async handleChatMessage(userId: string, message: string): Promise<any> {
    try {
      // Get or create session
      let session = this.activeSessions.get(userId);
      if (!session) {
        session = {
          userId,
          conversationHistory: [],
          activeFiles: new Map(),
          isGenerating: false
        };
        this.activeSessions.set(userId, session);
      }

      // Add user message to conversation
      session.conversationHistory.push({ role: 'user', content: message });

      // Determine if this is app generation request
      const isAppRequest = this.isAppGenerationRequest(message);

      if (isAppRequest) {
        // Queue high-priority app generation task
        const appTask: LoopTask = {
          id: `app_${Date.now()}_${userId}`,
          type: 'file_generation',
          data: { userId, message, session },
          retries: 0,
          maxRetries: 3,
          priority: 'high',
          status: 'pending'
        };
        this.addTask(appTask);

        return {
          success: true,
          type: 'app_generation',
          message: "I'll create that application for you! Let me work on it...",
          isGenerating: true
        };
      } else {
        // Handle as regular chat
        const chatTask: LoopTask = {
          id: `chat_${Date.now()}_${userId}`,
          type: 'chat',
          data: { userId, message, session },
          retries: 0,
          maxRetries: 2,
          priority: 'medium',
          status: 'pending'
        };
        this.addTask(chatTask);

        // Generate immediate response for chat
        const response = await this.generateChatResponse(message, session.conversationHistory);
        session.conversationHistory.push({ role: 'assistant', content: response });

        return {
          success: true,
          type: 'chat',
          message: response,
          isGenerating: false
        };
      }
    } catch (error) {
      console.error('❌ Chat handling error:', error);
      return {
        success: false,
        error: 'Failed to process message',
        message: "I encountered an error. Let me try again..."
      };
    }
  }

  // Process tasks from queue with error handling and retries
  private async processPendingTasks() {
    const pendingTasks = this.taskQueue
      .filter(task => task.status === 'pending')
      .sort((a, b) => this.getPriorityValue(a.priority) - this.getPriorityValue(b.priority));

    for (const task of pendingTasks.slice(0, 3)) { // Process max 3 tasks at once
      task.status = 'processing';

      try {
        await this.executeTask(task);
        task.status = 'completed';
        console.log(`✅ Task completed: ${task.id}`);
      } catch (error) {
        console.error(`❌ Task failed: ${task.id}`, error);
        await this.handleTaskError(task, error);
      }
    }
  }

  // Execute individual task based on type
  private async executeTask(task: LoopTask) {
    switch (task.type) {
      case 'file_generation':
        await this.executeFileGeneration(task);
        break;
      case 'chat':
        await this.executeChatTask(task);
        break;
      case 'preview_update':
        await this.executePreviewUpdate(task);
        break;
      default:
        throw new Error(`Unknown task type: ${task.type}`);
    }
  }

  // Execute file generation with advanced AI
  private async executeFileGeneration(task: LoopTask) {
    const { userId, message, session } = task.data;

    console.log(`🧠 Generating advanced application for user: ${userId}`);

    // Use comprehensive AI service for high-quality code generation
    const result = await comprehensiveAI.generateProject({
      prompt: message,
      userId,
      conversationHistory: session.conversationHistory
    });

    if (result.success && result.files) {
      // Update session with generated files
      for (const [filename, fileData] of Object.entries(result.files)) {
        session.activeFiles.set(filename, {
          content: fileData.content,
          language: fileData.language
        });
      }

      // Create preview server if project generated
      if (result.projectId && result.previewUrl) {
        session.projectId = result.projectId;

        // Queue preview update task
        const previewTask: LoopTask = {
          id: `preview_${Date.now()}_${userId}`,
          type: 'preview_update',
          data: { userId, projectId: result.projectId, previewUrl: result.previewUrl },
          retries: 0,
          maxRetries: 2,
          priority: 'high',
          status: 'pending'
        };
        this.addTask(previewTask);
      }

      // Add AI response about generated files
      const response = `✅ I've created your application with ${Object.keys(result.files).length} files! The project includes:\n\n${Object.keys(result.files).map(f => `📄 ${f}`).join('\n')}\n\n${result.previewUrl ? `🌐 Live preview: ${result.previewUrl}` : ''}`;

      session.conversationHistory.push({ role: 'assistant', content: response });

      console.log(`✅ Generated ${Object.keys(result.files).length} files for ${userId}`);
    } else {
      throw new Error(result.error || 'File generation failed');
    }
  }

  // Execute chat task with advanced responses
  private async executeChatTask(task: LoopTask) {
    const { userId, message, session } = task.data;

    // Generate contextual response based on current project state
    let contextualInfo = '';
    if (session.activeFiles.size > 0) {
      contextualInfo = `\n\nCurrent project files: ${Array.from(session.activeFiles.keys()).join(', ')}`;
    }

    const response = await this.generateChatResponse(message + contextualInfo, session.conversationHistory);
    session.conversationHistory.push({ role: 'assistant', content: response });
  }

  // Execute preview update
  private async executePreviewUpdate(task: LoopTask) {
    const { projectId, previewUrl } = task.data;
    console.log(`🖥️ Preview server ready: ${previewUrl}`);
    // Preview is already running, just log success
  }

  // Handle task errors with exponential backoff
  private async handleTaskError(task: LoopTask, error: any) {
    task.retries++;

    if (task.retries <= task.maxRetries) {
      const delay = this.retryDelays[Math.min(task.retries - 1, this.retryDelays.length - 1)];
      console.log(`🔄 Retrying task ${task.id} in ${delay}ms (attempt ${task.retries}/${task.maxRetries})`);

      await this.sleep(delay);
      task.status = 'pending'; // Re-queue for retry
    } else {
      task.status = 'failed';
      console.error(`❌ Task failed permanently: ${task.id}`);

      // Notify user of failure if it's their task
      if (task.data.userId) {
        const session = this.activeSessions.get(task.data.userId);
        if (session) {
          session.conversationHistory.push({
            role: 'assistant',
            content: `I encountered an issue with your request. Let me try a different approach...`
          });
        }
      }
    }
  }

  // Generate high-quality chat responses
  private async generateChatResponse(message: string, history: Array<{ role: string; content: string }>): Promise<string> {
    try {
      // Use comprehensive AI for chat responses too
      const result = await comprehensiveAI.generateProject({
        prompt: `Respond conversationally to: "${message}". Keep it helpful and engaging.`,
        projectType: 'conversation',
        conversationHistory: history.slice(-10) // Last 10 messages for context
      });

      return result.message || "I'm here to help! What would you like to build or discuss?";
    } catch (error) {
      console.error('Chat response error:', error);
      return "I'm having a small issue, but I'm still here to help! What can I do for you?";
    }
  }

  // Check if message is requesting app generation
  private isAppGenerationRequest(message: string): boolean {
    const appKeywords = [
      'create', 'build', 'make', 'generate', 'develop', 'app', 'application',
      'website', 'calculator', 'todo', 'game', 'dashboard', 'api', 'server',
      'component', 'react', 'python', 'javascript', 'typescript', 'html'
    ];

    const lowerMessage = message.toLowerCase();
    return appKeywords.some(keyword => lowerMessage.includes(keyword)) && 
           lowerMessage.length > 10; // Avoid triggering on single words
  }

  // Utility methods
  private addTask(task: LoopTask) {
    this.taskQueue.push(task);
    console.log(`📋 Task queued: ${task.id} (${task.type}, ${task.priority} priority)`);
  }

  private getPriorityValue(priority: string): number {
    switch (priority) {
      case 'high': return 1;
      case 'medium': return 2;
      case 'low': return 3;
      default: return 2;
    }
  }

  private async maintainActiveSessions() {
    // Clean up old inactive sessions
    const now = Date.now();
    for (const [userId, session] of this.activeSessions.entries()) {
      // Remove sessions inactive for more than 1 hour
      const lastActivity = session.conversationHistory.length > 0 
        ? Date.now() // Simplified - in real app track actual timestamps
        : 0;

      if (now - lastActivity > 3600000) { // 1 hour
        this.activeSessions.delete(userId);
        console.log(`🧹 Cleaned up inactive session: ${userId}`);
      }
    }
  }

  private async cleanupCompletedTasks() {
    const completedCount = this.taskQueue.filter(task => task.status === 'completed').length;
    if (completedCount > 100) {
      this.taskQueue = this.taskQueue.filter(task => task.status !== 'completed');
      console.log(`🧹 Cleaned up ${completedCount} completed tasks`);
    }
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  // Public methods for external access
  getSession(userId: string): ChatSession | undefined {
    return this.activeSessions.get(userId);
  }

  getTaskStatus(taskId: string): string | undefined {
    const task = this.taskQueue.find(t => t.id === taskId);
    return task?.status;
  }

  getActiveTasksCount(): number {
    return this.taskQueue.filter(t => t.status === 'pending' || t.status === 'processing').length;
  }

  stop() {
    this.isRunning = false;
    console.log('🛑 Enhanced AI Loop stopped');
  }
}

export const enhancedAILoop = new EnhancedAILoop();

```tsx
import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Card } from './ui/card';
import { Badge } from './ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import { ScrollArea } from './ui/scroll-area';
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from './ui/resizable';
import { 
  Send, 
  Play, 
  Square, 
  RotateCcw, 
  Code, 
  Eye, 
  Terminal,
  FileCode,
  Loader2,
  CheckCircle,
  AlertCircle,
  Sparkles
} from 'lucide-react';

interface ChatMessage {
  id: string;
  type: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: Date;
  metadata?: {
    files?: Record<string, { content: string; language: string }>;
    previewUrl?: string;
    isGenerating?: boolean;
  };
}

interface GeneratedFile {
  name: string;
  content: string;
  language: string;
  path: string;
}

const ProfessionalChatInterface: React.FC = () => {
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: '1',
      type: 'system',
      content: '👋 Welcome to AI AppBuilder Pro! I can create full applications, chat with you, and provide live previews. What would you like to build today?',
      timestamp: new Date()
    }
  ]);

  const [inputMessage, setInputMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [generatedFiles, setGeneratedFiles] = useState<GeneratedFile[]>([]);
  const [previewUrl, setPreviewUrl] = useState<string>('');
  const [activeTab, setActiveTab] = useState('chat');
  const [selectedFile, setSelectedFile] = useState<GeneratedFile | null>(null);
  const [isPreviewRunning, setIsPreviewRunning] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const iframeRef = useRef<HTMLIFrameElement>(null);

  // Auto-scroll to bottom of chat
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Handle message sending with continuous loop support
  const handleSendMessage = useCallback(async () => {
    if (!inputMessage.trim() || isLoading) return;

    const userMessage: ChatMessage = {
      id: `user-${Date.now()}`,
      type: 'user',
      content: inputMessage,
      timestamp: new Date()
    };

    setMessages(prev => [...prev, userMessage]);
    setInputMessage('');
    setIsLoading(true);

    try {
      // Send to enhanced AI loop system
      const response = await fetch('/api/enhanced-chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: inputMessage,
          userId: 'current-user', // In real app, get from auth
          requestHighQuality: true
        })
      });

      const data = await response.json();

      if (data.success) {
        const assistantMessage: ChatMessage = {
          id: `assistant-${Date.now()}`,
          type: 'assistant',
          content: data.message,
          timestamp: new Date(),
          metadata: {
            files: data.files,
            previewUrl: data.previewUrl,
            isGenerating: data.isGenerating
          }
        };

        setMessages(prev => [...prev, assistantMessage]);

        // Handle file generation
        if (data.files && Object.keys(data.files).length > 0) {
          const newFiles: GeneratedFile[] = Object.entries(data.files).map(([name, fileData]: [string, any]) => ({
            name,
            content: fileData.content,
            language: fileData.language,
            path: fileData.path || name
          }));
          
          setGeneratedFiles(prev => {
            const existing = new Map(prev.map(f => [f.name, f]));
            newFiles.forEach(file => existing.set(file.name, file));
            return Array.from(existing.values());
          });

          if (!selectedFile && newFiles.length > 0) {
            setSelectedFile(newFiles[0]);
          }
        }

        // Handle preview URL
        if (data.previewUrl) {
          setPreviewUrl(data.previewUrl);
          setIsPreviewRunning(true);
          setActiveTab('preview');
        }

        // Handle continuous generation
        if (data.isGenerating) {
          pollForUpdates(data.taskId);
        }
      }
    } catch (error) {
      console.error('Chat error:', error);
      const errorMessage: ChatMessage = {
        id: `error-${Date.now()}`,
        type: 'system',
        content: 'Sorry, I encountered an error. Please try again.',
        timestamp: new Date()
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  }, [inputMessage, isLoading, selectedFile]);

  // Poll for updates during generation
  const pollForUpdates = useCallback(async (taskId: string) => {
    const pollInterval = setInterval(async () => {
      try {
        const response = await fetch(`/api/task-status/${taskId}`);
        const data = await response.json();

        if (data.status === 'completed' && data.files) {
          clearInterval(pollInterval);
          
          // Update files
          const newFiles: GeneratedFile[] = Object.entries(data.files).map(([name, fileData]: [string, any]) => ({
            name,
            content: fileData.content,
            language: fileData.language,
            path: fileData.path || name
          }));
          
          setGeneratedFiles(newFiles);
          
          if (data.previewUrl) {
            setPreviewUrl(data.previewUrl);
            setIsPreviewRunning(true);
          }

          // Add completion message
          const completionMessage: ChatMessage = {
            id: `completion-${Date.now()}`,
            type: 'assistant',
            content: `✅ Your application is ready! Generated ${newFiles.length} files with professional code quality.`,
            timestamp: new Date()
          };
          setMessages(prev => [...prev, completionMessage]);
        }
      } catch (error) {
        console.error('Polling error:', error);
        clearInterval(pollInterval);
      }
    }, 2000);

    // Stop polling after 2 minutes
    setTimeout(() => clearInterval(pollInterval), 120000);
  }, []);

  // Handle keyboard shortcuts
  const handleKeyPress = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  }, [handleSendMessage]);

  // Run preview
  const handleRunPreview = useCallback(async () => {
    if (!previewUrl) {
      try {
        const response = await fetch('/api/create-preview', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ files: generatedFiles })
        });
        
        const data = await response.json();
        if (data.success && data.previewUrl) {
          setPreviewUrl(data.previewUrl);
          setIsPreviewRunning(true);
        }
      } catch (error) {
        console.error('Preview creation error:', error);
      }
    } else {
      setIsPreviewRunning(true);
    }
  }, [previewUrl, generatedFiles]);

  // Stop preview
  const handleStopPreview = useCallback(() => {
    setIsPreviewRunning(false);
  }, []);

  // Restart preview
  const handleRestartPreview = useCallback(() => {
    if (iframeRef.current) {
      iframeRef.current.src = iframeRef.current.src;
    }
  }, []);

  // Render syntax highlighted code
  const renderCode = useCallback((content: string, language: string) => {
    return (
      <pre className="bg-gray-900 text-gray-100 p-4 rounded-lg overflow-auto text-sm">
        <code className={`language-${language}`}>{content}</code>
      </pre>
    );
  }, []);

  return (
    <div className="h-screen flex flex-col bg-gray-50">
      {/* Header */}
      <div className="flex items-center justify-between p-4 bg-white border-b border-gray-200">
        <h1 className="text-xl font-semibold text-gray-800 flex items-center gap-2">
          <Sparkles className="w-5 h-5 text-blue-500" />
          AI AppBuilder Pro
        </h1>
        <div className="flex items-center gap-2">
          <Badge variant={isLoading ? "secondary" : "default"}>
            {isLoading ? "Generating..." : "Ready"}
          </Badge>
          {generatedFiles.length > 0 && (
            <Badge variant="outline">
              {generatedFiles.length} files
            </Badge>
          )}
        </div>
      </div>

      {/* Main Content */}
      <ResizablePanelGroup direction="horizontal" className="flex-1">
        {/* Chat Panel */}
        <ResizablePanel defaultSize={50} minSize={30}>
          <div className="h-full flex flex-col">
            {/* Messages */}
            <ScrollArea className="flex-1 p-4">
              <div className="space-y-4 max-w-4xl mx-auto">
                {messages.map((message) => (
                  <div
                    key={message.id}
                    className={`flex ${message.type === 'user' ? 'justify-end' : 'justify-start'}`}
                  >
                    <Card className={`max-w-[80%] p-4 ${
                      message.type === 'user' 
                        ? 'bg-blue-500 text-white' 
                        : message.type === 'system'
                        ? 'bg-gray-100 border-gray-300'
                        : 'bg-white'
                    }`}>
                      <div className="whitespace-pre-wrap">{message.content}</div>
                      {message.metadata?.files && (
                        <div className="mt-3 pt-3 border-t border-gray-200">
                          <div className="text-sm text-gray-600 mb-2">Generated files:</div>
                          <div className="flex flex-wrap gap-1">
                            {Object.keys(message.metadata.files).map(filename => (
                              <Badge key={filename} variant="secondary" className="text-xs">
                                <FileCode className="w-3 h-3 mr-1" />
                                {filename}
                              </Badge>
                            ))}
                          </div>
                        </div>
                      )}
                    </Card>
                  </div>
                ))}
                {isLoading && (
                  <div className="flex justify-start">
                    <Card className="bg-white p-4 max-w-[80%]">
                      <div className="flex items-center gap-2">
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span>AI is working on your request...</span>
                      </div>
                    </Card>
                  </div>
                )}
                <div ref={messagesEndRef} />
              </div>
            </ScrollArea>

            {/* Input */}
            <div className="p-4 bg-white border-t border-gray-200">
              <div className="flex gap-2 max-w-4xl mx-auto">
                <Input
                  value={inputMessage}
                  onChange={(e) => setInputMessage(e.target.value)}
                  onKeyPress={handleKeyPress}
                  placeholder="Ask me to build something or chat with me..."
                  className="flex-1"
                  disabled={isLoading}
                />
                <Button 
                  onClick={handleSendMessage} 
                  disabled={isLoading || !inputMessage.trim()}
                  className="bg-blue-500 hover:bg-blue-600"
                >
                  {isLoading ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Send className="w-4 h-4" />
                  )}
                </Button>
              </div>
            </div>
          </div>
        </ResizablePanel>

        <ResizableHandle withHandle />

        {/* Files & Preview Panel */}
        <ResizablePanel defaultSize={50} minSize={30}>
          <div className="h-full flex flex-col bg-white">
            <Tabs value={activeTab} onValueChange={setActiveTab} className="h-full flex flex-col">
              <div className="flex items-center justify-between p-4 border-b border-gray-200">
                <TabsList className="grid w-[400px] grid-cols-3">
                  <TabsTrigger value="chat">Files</TabsTrigger>
                  <TabsTrigger value="preview">Preview</TabsTrigger>
                  <TabsTrigger value="terminal">Terminal</TabsTrigger>
                </TabsList>
                
                {activeTab === 'preview' && (
                  <div className="flex items-center gap-2">
                    <Button
                      size="sm"
                      onClick={handleRunPreview}
                      disabled={generatedFiles.length === 0}
                      className="bg-green-500 hover:bg-green-600"
                    >
                      <Play className="w-4 h-4 mr-1" />
                      Run
                    </Button>
                    {isPreviewRunning && (
                      <>
                        <Button size="sm" variant="outline" onClick={handleStopPreview}>
                          <Square className="w-4 h-4 mr-1" />
                          Stop
                        </Button>
                        <Button size="sm" variant="outline" onClick={handleRestartPreview}>
                          <RotateCcw className="w-4 h-4 mr-1" />
                          Restart
                        </Button>
                      </>
                    )}
                  </div>
                )}
              </div>

              <TabsContent value="chat" className="flex-1 m-0">
                <ResizablePanelGroup direction="vertical">
                  {/* File Explorer */}
                  <ResizablePanel defaultSize={30} minSize={20}>
                    <div className="p-4">
                      <h3 className="font-semibold mb-3 flex items-center gap-2">
                        <FileCode className="w-4 h-4" />
                        Project Files
                      </h3>
                      {generatedFiles.length === 0 ? (
                        <div className="text-center py-8 text-gray-500">
                          <FileCode className="w-8 h-8 mx-auto mb-2 opacity-50" />
                          <p>No files generated yet</p>
                          <p className="text-sm">Ask me to create something!</p>
                        </div>
                      ) : (
                        <div className="space-y-1">
                          {generatedFiles.map((file) => (
                            <button
                              key={file.name}
                              onClick={() => setSelectedFile(file)}
                              className={`w-full text-left p-2 rounded hover:bg-gray-100 transition-colors ${
                                selectedFile?.name === file.name ? 'bg-blue-50 border border-blue-200' : ''
                              }`}
                            >
                              <div className="font-medium text-sm">{file.name}</div>
                              <div className="text-xs text-gray-500 capitalize">{file.language}</div>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  </ResizablePanel>

                  <ResizableHandle withHandle />

                  {/* Code Editor */}
                  <ResizablePanel defaultSize={70}>
                    <div className="p-4 h-full">
                      {selectedFile ? (
                        <div className="h-full flex flex-col">
                          <div className="flex items-center justify-between mb-3">
                            <h4 className="font-semibold flex items-center gap-2">
                              <Code className="w-4 h-4" />
                              {selectedFile.name}
                            </h4>
                            <Badge variant="outline" className="capitalize">
                              {selectedFile.language}
                            </Badge>
                          </div>
                          <ScrollArea className="flex-1 rounded-lg border">
                            {renderCode(selectedFile.content, selectedFile.language)}
                          </ScrollArea>
                        </div>
                      ) : (
                        <div className="h-full flex items-center justify-center text-gray-500">
                          <div className="text-center">
                            <Code className="w-8 h-8 mx-auto mb-2 opacity-50" />
                            <p>Select a file to view its contents</p>
                          </div>
                        </div>
                      )}
                    </div>
                  </ResizablePanel>
                </ResizablePanelGroup>
              </TabsContent>

              <TabsContent value="preview" className="flex-1 m-0">
                <div className="h-full flex flex-col">
                  {previewUrl && isPreviewRunning ? (
                    <div className="flex-1 bg-white">
                      <iframe
                        ref={iframeRef}
                        src={previewUrl}
                        className="w-full h-full border-0"
                        title="Live Preview"
                        sandbox="allow-scripts allow-same-origin allow-forms"
                      />
                    </div>
                  ) : (
                    <div className="flex-1 flex items-center justify-center bg-gray-50">
                      <div className="text-center text-gray-500">
                        <Eye className="w-12 h-12 mx-auto mb-4 opacity-50" />
                        <h3 className="text-lg font-medium mb-2">No Preview Available</h3>
                        <p className="text-sm mb-4">
                          {generatedFiles.length === 0 
                            ? "Generate some files first, then click Run to see your app"
                            : "Click the Run button to start the preview server"
                          }
                        </p>
                        {generatedFiles.length > 0 && (
                          <Button onClick={handleRunPreview} className="bg-green-500 hover:bg-green-600">
                            <Play className="w-4 h-4 mr-1" />
                            Start Preview
                          </Button>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </TabsContent>

              <TabsContent value="terminal" className="flex-1 m-0">
                <div className="h-full bg-gray-900 text-green-400 p-4 font-mono text-sm overflow-auto">
                  <div className="mb-2">
                    <span className="text-gray-500">$</span> AI AppBuilder Pro Terminal
                  </div>
                  <div className="mb-2">
                    <span className="text-blue-400">INFO:</span> Enhanced AI Loop is running continuously
                  </div>
                  <div className="mb-2">
                    <span className="text-green-400">SUCCESS:</span> Ready to process requests with error handling
                  </div>
                  {generatedFiles.length > 0 && (
                    <div className="mb-2">
                      <span className="text-green-400">FILES:</span> Generated {generatedFiles.length} project files
                    </div>
                  )}
                  {previewUrl && (
                    <div className="mb-2">
                      <span className="text-blue-400">PREVIEW:</span> Server running at {previewUrl}
                    </div>
                  )}
                  <div className="text-gray-500">
                    Ready for next command...
                  </div>
                </div>
              </TabsContent>
            </Tabs>
          </div>
        </ResizablePanel>
      </ResizablePanelGroup>
    </div>
  );
};

export default ProfessionalChatInterface;
```

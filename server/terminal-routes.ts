import { Request, Response, Router } from 'express';
import { terminalRunner } from './terminal-runner';
import { nanoid } from 'nanoid';

const router = Router();

// Run terminal command with streaming output
router.post('/terminal/run', (req: Request, res: Response) => {
  const { command, path, sessionId } = req.body;

  if (!command || !path) {
    return res.status(400).json({ error: 'Command and path are required' });
  }

  // Security check
  if (!terminalRunner.isCommandSafe(command)) {
    return res.status(400).json({ error: 'Command not allowed for security reasons' });
  }

  const id = sessionId || nanoid();

  // Set up Server-Sent Events
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Cache-Control'
  });

  res.write(`data: ${JSON.stringify({ type: 'start', sessionId: id, command })}\n\n`);

  terminalRunner.runCommand(
    id,
    command,
    path,
    (data, type) => {
      res.write(`data: ${JSON.stringify({ type: 'output', data, stream: type })}\n\n`);
    },
    (code) => {
      res.write(`data: ${JSON.stringify({ type: 'close', code })}\n\n`);
      res.end();
    }
  );

  // Handle client disconnect
  req.on('close', () => {
    terminalRunner.killSession(id);
  });
});

// Run command and return result (non-streaming)
router.post('/terminal/exec', async (req: Request, res: Response) => {
  const { command, path } = req.body;

  if (!command || !path) {
    return res.status(400).json({ error: 'Command and path are required' });
  }

  if (!terminalRunner.isCommandSafe(command)) {
    return res.status(400).json({ error: 'Command not allowed for security reasons' });
  }

  try {
    const result = await terminalRunner.runCommandAsync(command, path);
    res.json({
      success: true,
      command,
      path,
      stdout: result.stdout,
      stderr: result.stderr,
      exitCode: result.code
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Kill terminal session
router.post('/terminal/kill', (req: Request, res: Response) => {
  const { sessionId } = req.body;

  if (!sessionId) {
    return res.status(400).json({ error: 'Session ID is required' });
  }

  const killed = terminalRunner.killSession(sessionId);
  res.json({ success: killed, sessionId });
});

// Get session info
router.get('/terminal/session/:sessionId', (req: Request, res: Response) => {
  const { sessionId } = req.params;
  const session = terminalRunner.getSession(sessionId);

  if (!session) {
    return res.status(404).json({ error: 'Session not found' });
  }

  res.json({
    id: session.id,
    cwd: session.cwd,
    isActive: session.isActive,
    outputLines: session.output.length
  });
});

// Get all active sessions
router.get('/terminal/sessions', (req: Request, res: Response) => {
  const sessions = terminalRunner.getActiveSessions();
  res.json({
    sessions: sessions.map(s => ({
      id: s.id,
      cwd: s.cwd,
      isActive: s.isActive,
      outputLines: s.output.length
    }))
  });
});

// Get safe commands for a language
router.get('/terminal/commands/:language', (req: Request, res: Response) => {
  const { language } = req.params;
  const commands = terminalRunner.getSafeCommands(language);
  const setupCommands = terminalRunner.getSetupCommands(language, '');
  
  res.json({
    language,
    safeCommands: commands,
    setupCommands
  });
});

export default router;
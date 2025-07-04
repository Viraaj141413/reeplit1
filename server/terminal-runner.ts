import { spawn, exec } from 'child_process';
import { EventEmitter } from 'events';

export interface TerminalSession {
  id: string;
  process: any;
  cwd: string;
  output: string[];
  isActive: boolean;
}

class TerminalRunner extends EventEmitter {
  private sessions: Map<string, TerminalSession> = new Map();

  runCommand(
    sessionId: string,
    command: string, 
    cwd: string,
    onData: (data: string, type: 'stdout' | 'stderr') => void,
    onClose: (code: number) => void
  ): TerminalSession {
    // Kill existing session if it exists
    this.killSession(sessionId);

    const parts = command.split(' ');
    const proc = spawn(parts[0], parts.slice(1), { 
      cwd, 
      shell: true,
      stdio: 'pipe'
    });

    const session: TerminalSession = {
      id: sessionId,
      process: proc,
      cwd,
      output: [],
      isActive: true
    };

    proc.stdout?.on('data', (data) => {
      const output = data.toString();
      session.output.push(output);
      onData(output, 'stdout');
    });

    proc.stderr?.on('data', (data) => {
      const output = data.toString();
      session.output.push(output);
      onData(output, 'stderr');
    });

    proc.on('close', (code) => {
      session.isActive = false;
      onClose(code || 0);
    });

    proc.on('error', (error) => {
      const errorMsg = `Error: ${error.message}`;
      session.output.push(errorMsg);
      onData(errorMsg, 'stderr');
      session.isActive = false;
      onClose(1);
    });

    this.sessions.set(sessionId, session);
    return session;
  }

  async runCommandAsync(command: string, cwd: string): Promise<{ stdout: string; stderr: string; code: number }> {
    return new Promise((resolve) => {
      let stdout = '';
      let stderr = '';

      const proc = exec(command, { cwd }, (error, stdoutData, stderrData) => {
        resolve({
          stdout: stdoutData,
          stderr: stderrData,
          code: error ? error.code || 1 : 0
        });
      });

      proc.stdout?.on('data', (data) => {
        stdout += data.toString();
      });

      proc.stderr?.on('data', (data) => {
        stderr += data.toString();
      });
    });
  }

  killSession(sessionId: string): boolean {
    const session = this.sessions.get(sessionId);
    if (session && session.isActive) {
      try {
        session.process.kill('SIGTERM');
        session.isActive = false;
        this.sessions.delete(sessionId);
        return true;
      } catch (error) {
        console.error(`Failed to kill session ${sessionId}:`, error);
        return false;
      }
    }
    return false;
  }

  getSession(sessionId: string): TerminalSession | undefined {
    return this.sessions.get(sessionId);
  }

  getAllSessions(): TerminalSession[] {
    return Array.from(this.sessions.values());
  }

  getActiveSessions(): TerminalSession[] {
    return Array.from(this.sessions.values()).filter(s => s.isActive);
  }

  // Predefined safe commands for different languages
  getSafeCommands(language: string): string[] {
    const commands: Record<string, string[]> = {
      'node': ['npm install', 'npm run build', 'npm run dev', 'npm start', 'npm test'],
      'python': ['pip install -r requirements.txt', 'python main.py', 'python app.py', 'flask run'],
      'java': ['mvn compile', 'mvn test', 'mvn exec:java', 'gradle build', 'gradle run'],
      'go': ['go mod tidy', 'go build', 'go run main.go', 'go test'],
      'rust': ['cargo build', 'cargo run', 'cargo test', 'cargo check'],
      'csharp': ['dotnet restore', 'dotnet build', 'dotnet run', 'dotnet test'],
      'php': ['composer install', 'php -S localhost:8000', 'php artisan serve'],
      'ruby': ['bundle install', 'ruby main.rb', 'rails server'],
      'flutter': ['flutter pub get', 'flutter run', 'flutter build', 'flutter test']
    };

    return commands[language] || [];
  }

  // Security: Check if command is safe to run
  isCommandSafe(command: string): boolean {
    const dangerousCommands = [
      'rm -rf',
      'rmdir',
      'del',
      'format',
      'shutdown',
      'reboot',
      'halt',
      'kill',
      'killall',
      'dd if=',
      'mkfs',
      'fdisk',
      ':(){ :|:& };:',
      'sudo',
      'su',
      'chmod 777',
      'chown',
      'passwd',
      'useradd',
      'userdel'
    ];

    const lowerCommand = command.toLowerCase();
    return !dangerousCommands.some(dangerous => lowerCommand.includes(dangerous));
  }

  // Get appropriate commands for project setup
  getSetupCommands(language: string, projectPath: string): string[] {
    const setupCommands: Record<string, string[]> = {
      'react': ['npm install', 'npm run dev'],
      'node': ['npm install', 'npm start'],
      'python': ['pip install -r requirements.txt', 'python main.py'],
      'java': ['mvn compile', 'mvn exec:java'],
      'go': ['go mod tidy', 'go run main.go'],
      'rust': ['cargo build', 'cargo run'],
      'csharp': ['dotnet restore', 'dotnet run'],
      'php': ['composer install', 'php -S localhost:8000'],
      'flutter': ['flutter pub get', 'flutter run -d web-server --web-port=3000']
    };

    return setupCommands[language] || [];
  }
}

export const terminalRunner = new TerminalRunner();
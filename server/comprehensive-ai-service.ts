import OpenAI from 'openai';
import { GoogleGenAI } from '@google/genai';
import fs from 'fs/promises';
import path from 'path';
import { spawn, exec } from 'child_process';
import { nanoid } from 'nanoid';

interface AIGenerationRequest {
  prompt: string;
  projectType?: string;
  language?: string;
  framework?: string;
  conversationHistory?: Array<{ role: 'user' | 'assistant'; content: string }>;
  userId?: string;
  deviceId?: string;
}

interface AIGenerationResponse {
  success: boolean;
  message: string;
  files?: Record<string, { content: string; language: string; path: string }>;
  previewUrl?: string;
  projectId?: string;
  terminalOutput?: string[];
  error?: string;
}

interface PreviewServer {
  id: string;
  port: number;
  process: any;
  projectPath: string;
  language: string;
}

class ComprehensiveAIService {
  private gemini: GoogleGenAI | null = null;
  private openai: OpenAI | null = null;
  private previewServers: Map<string, PreviewServer> = new Map();
  private basePort = 3001;
  private workspaceDir = path.join(process.cwd(), 'workspace');
  
  // Supported languages and their configurations
  private languageConfigs = {
    // Frontend Technologies
    'html': { ext: '.html', buildCmd: null, runCmd: 'serve', port: true },
    'css': { ext: '.css', buildCmd: null, runCmd: null, port: false },
    'javascript': { ext: '.js', buildCmd: 'npm run build', runCmd: 'npm run dev', port: true },
    'typescript': { ext: '.ts', buildCmd: 'npm run build', runCmd: 'npm run dev', port: true },
    'react': { ext: '.tsx', buildCmd: 'npm run build', runCmd: 'npm run dev', port: true },
    'vue': { ext: '.vue', buildCmd: 'npm run build', runCmd: 'npm run dev', port: true },
    'angular': { ext: '.ts', buildCmd: 'ng build', runCmd: 'ng serve', port: true },
    
    // Backend Technologies  
    'node': { ext: '.js', buildCmd: 'npm run build', runCmd: 'npm start', port: true },
    'python': { ext: '.py', buildCmd: null, runCmd: 'python main.py', port: true },
    'java': { ext: '.java', buildCmd: 'mvn compile', runCmd: 'mvn exec:java', port: true },
    'csharp': { ext: '.cs', buildCmd: 'dotnet build', runCmd: 'dotnet run', port: true },
    'cpp': { ext: '.cpp', buildCmd: 'g++ -o main main.cpp', runCmd: './main', port: false },
    'go': { ext: '.go', buildCmd: 'go build', runCmd: 'go run main.go', port: true },
    'ruby': { ext: '.rb', buildCmd: null, runCmd: 'ruby main.rb', port: true },
    'php': { ext: '.php', buildCmd: null, runCmd: 'php -S localhost:8000', port: true },
    'rust': { ext: '.rs', buildCmd: 'cargo build', runCmd: 'cargo run', port: true },
    
    // Mobile Development
    'swift': { ext: '.swift', buildCmd: 'swift build', runCmd: 'swift run', port: false },
    'kotlin': { ext: '.kt', buildCmd: 'kotlinc', runCmd: 'kotlin', port: false },
    'dart': { ext: '.dart', buildCmd: 'flutter build', runCmd: 'flutter run', port: true },
    'flutter': { ext: '.dart', buildCmd: 'flutter build web', runCmd: 'flutter run -d web-server', port: true },
    
    // Game Development
    'unity': { ext: '.cs', buildCmd: null, runCmd: null, port: false },
    'unreal': { ext: '.cpp', buildCmd: null, runCmd: null, port: false },
    'godot': { ext: '.gd', buildCmd: null, runCmd: null, port: false },
    
    // Data & Analytics
    'r': { ext: '.R', buildCmd: null, runCmd: 'Rscript main.R', port: false },
    'sql': { ext: '.sql', buildCmd: null, runCmd: null, port: false },
    
    // Config Files
    'json': { ext: '.json', buildCmd: null, runCmd: null, port: false },
    'yaml': { ext: '.yaml', buildCmd: null, runCmd: null, port: false },
    'xml': { ext: '.xml', buildCmd: null, runCmd: null, port: false },
    'markdown': { ext: '.md', buildCmd: null, runCmd: null, port: false },
    'text': { ext: '.txt', buildCmd: null, runCmd: null, port: false }
  };

  constructor() {
    this.initializeAIServices();
    this.ensureWorkspaceDir();
  }

  private async ensureWorkspaceDir() {
    try {
      await fs.access(this.workspaceDir);
    } catch {
      await fs.mkdir(this.workspaceDir, { recursive: true });
    }
  }

  private initializeAIServices() {
    // Initialize Gemini API
    try {
      if (process.env.GEMINI_API_KEY) {
        this.gemini = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
        console.log('🚀 Gemini 2.5 Flash API initialized');
      }
    } catch (error) {
      console.error('Failed to initialize Gemini:', error);
    }

    // Initialize OpenAI/GitHub API
    try {
      if (process.env.GITHUB_TOKEN) {
        this.openai = new OpenAI({
          baseURL: "https://models.github.ai/inference",
          apiKey: process.env.GITHUB_TOKEN,
        });
        console.log('🚀 GitHub API (GPT-4) initialized');
      }
    } catch (error) {
      console.error('Failed to initialize GitHub API:', error);
    }
  }

  async generateProject(request: AIGenerationRequest): Promise<AIGenerationResponse> {
    try {
      console.log('🧠 Starting comprehensive project generation...');
      
      // Detect project language and type
      const detectedLang = this.detectLanguage(request.prompt, request.language);
      const projectId = nanoid();
      const projectPath = path.join(this.workspaceDir, `user-${request.userId || 'default'}`, projectId);
      
      // Create project directory
      await fs.mkdir(projectPath, { recursive: true });
      
      // Generate code using AI
      let aiResponse;
      if (this.gemini) {
        aiResponse = await this.generateWithGemini(request, detectedLang);
      } else if (this.openai) {
        aiResponse = await this.generateWithGPT(request, detectedLang);
      } else {
        aiResponse = await this.generateWithLocal(request, detectedLang);
      }
      
      if (!aiResponse.success) {
        return aiResponse;
      }
      
      // Save generated files
      const savedFiles = await this.saveProjectFiles(projectPath, aiResponse.files || {});
      
      // Install dependencies and run setup commands
      const terminalOutput = await this.setupProject(projectPath, detectedLang);
      
      // Start preview server if applicable
      let previewUrl;
      if (this.languageConfigs[detectedLang]?.port) {
        previewUrl = await this.startPreviewServer(projectId, projectPath, detectedLang);
      }
      
      return {
        success: true,
        message: `Complete ${detectedLang} project generated successfully!`,
        files: savedFiles,
        projectId,
        previewUrl,
        terminalOutput
      };
      
    } catch (error) {
      console.error('Project generation error:', error);
      return {
        success: false,
        message: 'Failed to generate project',
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  private detectLanguage(prompt: string, explicitLang?: string): string {
    if (explicitLang && this.languageConfigs[explicitLang.toLowerCase()]) {
      return explicitLang.toLowerCase();
    }

    const lowerPrompt = prompt.toLowerCase();
    
    // Check for specific mentions
    if (lowerPrompt.includes('react') || lowerPrompt.includes('jsx') || lowerPrompt.includes('tsx')) return 'react';
    if (lowerPrompt.includes('vue')) return 'vue';
    if (lowerPrompt.includes('angular')) return 'angular';
    if (lowerPrompt.includes('python') || lowerPrompt.includes('flask') || lowerPrompt.includes('django')) return 'python';
    if (lowerPrompt.includes('java') || lowerPrompt.includes('spring')) return 'java';
    if (lowerPrompt.includes('c#') || lowerPrompt.includes('csharp') || lowerPrompt.includes('.net')) return 'csharp';
    if (lowerPrompt.includes('c++') || lowerPrompt.includes('cpp')) return 'cpp';
    if (lowerPrompt.includes('go') || lowerPrompt.includes('golang')) return 'go';
    if (lowerPrompt.includes('rust')) return 'rust';
    if (lowerPrompt.includes('ruby') || lowerPrompt.includes('rails')) return 'ruby';
    if (lowerPrompt.includes('php')) return 'php';
    if (lowerPrompt.includes('swift') || lowerPrompt.includes('ios')) return 'swift';
    if (lowerPrompt.includes('kotlin') || lowerPrompt.includes('android')) return 'kotlin';
    if (lowerPrompt.includes('flutter') || lowerPrompt.includes('dart')) return 'flutter';
    if (lowerPrompt.includes('unity') || lowerPrompt.includes('game')) return 'unity';
    if (lowerPrompt.includes('unreal')) return 'unreal';
    if (lowerPrompt.includes('godot')) return 'godot';
    if (lowerPrompt.includes('typescript') || lowerPrompt.includes('ts')) return 'typescript';
    if (lowerPrompt.includes('node') || lowerPrompt.includes('express')) return 'node';
    if (lowerPrompt.includes('html') || lowerPrompt.includes('website')) return 'html';
    
    // Default to React for web apps
    return 'react';
  }

  private buildComprehensiveSystemPrompt(language: string): string {
    const langConfig = this.languageConfigs[language];
    
    return `You are an expert ${language.toUpperCase()} developer. Generate a complete, production-ready ${language} application.

LANGUAGE: ${language.toUpperCase()}
FILE EXTENSION: ${langConfig?.ext}
BUILD COMMAND: ${langConfig?.buildCmd || 'None'}
RUN COMMAND: ${langConfig?.runCmd || 'None'}

CRITICAL REQUIREMENTS:
1. Generate COMPLETE, FUNCTIONAL code - never partial or placeholder code
2. Include ALL necessary files for a working project
3. Use modern best practices and patterns for ${language}
4. Include proper error handling and validation
5. Add comprehensive comments and documentation
6. Make the code production-ready with proper structure

REQUIRED FILES FOR ${language.toUpperCase()}:
${this.getRequiredFilesForLanguage(language)}

FILE FORMAT:
For each file, use this exact format:
\`\`\`filename:path/to/file.ext
[complete file content here]
\`\`\`

EXAMPLE STRUCTURE:
${this.getExampleStructure(language)}

Generate a complete, working application that can be immediately run and deployed.`;
  }

  private getRequiredFilesForLanguage(language: string): string {
    const requirements = {
      'react': `- package.json with dependencies
- vite.config.ts or webpack.config.js
- tsconfig.json
- index.html
- src/main.tsx
- src/App.tsx
- src/components/
- README.md`,
      
      'python': `- requirements.txt
- main.py or app.py
- templates/ (if web app)
- static/ (if web app)
- README.md
- .env.example`,
      
      'java': `- pom.xml or build.gradle
- src/main/java/Main.java
- src/main/resources/
- README.md`,
      
      'node': `- package.json
- tsconfig.json (if TypeScript)
- server.js or app.js
- routes/
- middleware/
- README.md`,
      
      'csharp': `- Program.cs or Main.cs
- *.csproj file
- appsettings.json
- README.md`,
      
      'go': `- go.mod
- main.go
- README.md`,
      
      'rust': `- Cargo.toml
- src/main.rs
- README.md`,
      
      'php': `- composer.json (if using packages)
- index.php
- config/
- README.md`,
      
      'flutter': `- pubspec.yaml
- lib/main.dart
- lib/screens/
- lib/widgets/
- README.md`,
      
      'unity': `- Assets/Scripts/
- ProjectSettings/
- README.md`,
      
      'html': `- index.html
- style.css
- script.js
- assets/
- README.md`
    };
    
    return requirements[language] || '- main file\n- README.md';
  }

  private getExampleStructure(language: string): string {
    const structures = {
      'react': `my-react-app/
├── package.json
├── vite.config.ts
├── index.html
├── src/
│   ├── main.tsx
│   ├── App.tsx
│   └── components/
└── README.md`,
      
      'python': `my-python-app/
├── requirements.txt
├── main.py
├── app/
│   ├── __init__.py
│   └── routes.py
└── README.md`,
      
      'java': `my-java-app/
├── pom.xml
├── src/main/java/
│   └── Main.java
└── README.md`
    };
    
    return structures[language] || `project/\n├── main${this.languageConfigs[language]?.ext || '.txt'}\n└── README.md`;
  }

  private async generateWithGemini(request: AIGenerationRequest, language: string): Promise<AIGenerationResponse> {
    if (!this.gemini) throw new Error('Gemini not configured');

    const systemPrompt = this.buildComprehensiveSystemPrompt(language);
    
    try {
      const response = await this.gemini.models.generateContent({
        model: "gemini-2.5-flash",
        contents: [{
          parts: [{
            text: `${systemPrompt}\n\nUser Request: ${request.prompt}\n\nGenerate a complete ${language} application based on this request.`
          }]
        }],
        config: {
          temperature: 0.7,
          maxOutputTokens: 8000,
          topP: 0.9
        }
      });

      const generatedText = response.candidates?.[0]?.content?.parts?.[0]?.text || '';
      const files = this.extractFilesFromResponse(generatedText);

      return {
        success: true,
        message: `Complete ${language} project generated with Gemini`,
        files
      };
    } catch (error) {
      console.error('Gemini generation error:', error);
      throw error;
    }
  }

  private async generateWithGPT(request: AIGenerationRequest, language: string): Promise<AIGenerationResponse> {
    if (!this.openai) throw new Error('OpenAI not configured');

    const systemPrompt = this.buildComprehensiveSystemPrompt(language);
    
    try {
      const response = await this.openai.chat.completions.create({
        model: "gpt-4-turbo",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: `Generate a complete ${language} application: ${request.prompt}` }
        ],
        max_tokens: 4000,
        temperature: 0.7
      });

      const generatedText = response.choices[0]?.message?.content || '';
      const files = this.extractFilesFromResponse(generatedText);

      return {
        success: true,
        message: `Complete ${language} project generated with GPT-4`,
        files
      };
    } catch (error) {
      console.error('GPT generation error:', error);
      throw error;
    }
  }

  private async generateWithLocal(request: AIGenerationRequest, language: string): Promise<AIGenerationResponse> {
    // Enhanced local generation with templates
    const files = this.generateLocalTemplate(language, request.prompt);
    
    return {
      success: true,
      message: `Complete ${language} project generated locally`,
      files
    };
  }

  private generateLocalTemplate(language: string, prompt: string): Record<string, { content: string; language: string; path: string }> {
    const templates: Record<string, any> = {
      'react': this.generateReactTemplate(prompt),
      'python': this.generatePythonTemplate(prompt),
      'java': this.generateJavaTemplate(prompt),
      'node': this.generateNodeTemplate(prompt),
      'html': this.generateHTMLTemplate(prompt),
      'csharp': this.generateCSharpTemplate(prompt),
      'go': this.generateGoTemplate(prompt),
      'rust': this.generateRustTemplate(prompt),
      'php': this.generatePHPTemplate(prompt),
      'flutter': this.generateFlutterTemplate(prompt)
    };

    return templates[language] || this.generateGenericTemplate(language, prompt);
  }

  private generateReactTemplate(prompt: string): Record<string, { content: string; language: string; path: string }> {
    return {
      'package.json': {
        content: JSON.stringify({
          "name": "react-app",
          "private": true,
          "version": "0.0.0",
          "type": "module",
          "scripts": {
            "dev": "vite",
            "build": "tsc && vite build",
            "preview": "vite preview"
          },
          "dependencies": {
            "react": "^18.2.0",
            "react-dom": "^18.2.0"
          },
          "devDependencies": {
            "@types/react": "^18.2.66",
            "@types/react-dom": "^18.2.22",
            "@vitejs/plugin-react": "^4.2.1",
            "typescript": "^5.2.2",
            "vite": "^5.2.0"
          }
        }, null, 2),
        language: 'json',
        path: 'package.json'
      },
      'vite.config.ts': {
        content: `import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    host: '0.0.0.0',
    port: 3000
  }
})`,
        language: 'typescript',
        path: 'vite.config.ts'
      },
      'index.html': {
        content: `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <link rel="icon" type="image/svg+xml" href="/vite.svg" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>React App</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>`,
        language: 'html',
        path: 'index.html'
      },
      'src/main.tsx': {
        content: `import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.tsx'
import './index.css'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)`,
        language: 'typescript',
        path: 'src/main.tsx'
      },
      'src/App.tsx': {
        content: `import { useState } from 'react'
import './App.css'

function App() {
  const [count, setCount] = useState(0)

  return (
    <div className="App">
      <h1>React Application</h1>
      <p>Generated based on: ${prompt}</p>
      <div className="card">
        <button onClick={() => setCount((count) => count + 1)}>
          count is {count}
        </button>
      </div>
    </div>
  )
}

export default App`,
        language: 'typescript',
        path: 'src/App.tsx'
      },
      'src/App.css': {
        content: `.App {
  text-align: center;
  padding: 2rem;
}

.card {
  padding: 2rem;
}

button {
  background: #646cff;
  color: white;
  border: none;
  padding: 0.5rem 1rem;
  border-radius: 4px;
  cursor: pointer;
}

button:hover {
  background: #535bf2;
}`,
        language: 'css',
        path: 'src/App.css'
      },
      'src/index.css': {
        content: `body {
  margin: 0;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', 'Oxygen',
    'Ubuntu', 'Cantarell', 'Fira Sans', 'Droid Sans', 'Helvetica Neue',
    sans-serif;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
}`,
        language: 'css',
        path: 'src/index.css'
      },
      'tsconfig.json': {
        content: JSON.stringify({
          "compilerOptions": {
            "target": "ES2020",
            "useDefineForClassFields": true,
            "lib": ["ES2020", "DOM", "DOM.Iterable"],
            "module": "ESNext",
            "skipLibCheck": true,
            "moduleResolution": "bundler",
            "allowImportingTsExtensions": true,
            "resolveJsonModule": true,
            "isolatedModules": true,
            "noEmit": true,
            "jsx": "react-jsx",
            "strict": true,
            "noUnusedLocals": true,
            "noUnusedParameters": true,
            "noFallthroughCasesInSwitch": true
          },
          "include": ["src"],
          "references": [{ "path": "./tsconfig.node.json" }]
        }, null, 2),
        language: 'json',
        path: 'tsconfig.json'
      }
    };
  }

  private generatePythonTemplate(prompt: string): Record<string, { content: string; language: string; path: string }> {
    return {
      'requirements.txt': {
        content: `flask==2.3.3
requests==2.31.0`,
        language: 'text',
        path: 'requirements.txt'
      },
      'main.py': {
        content: `from flask import Flask, render_template, jsonify

app = Flask(__name__)

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/api/hello')
def hello():
    return jsonify({"message": "Hello from Python!", "prompt": "${prompt}"})

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000, debug=True)`,
        language: 'python',
        path: 'main.py'
      },
      'templates/index.html': {
        content: `<!DOCTYPE html>
<html>
<head>
    <title>Python Flask App</title>
</head>
<body>
    <h1>Python Application</h1>
    <p>Generated based on: ${prompt}</p>
    <button onclick="fetchData()">Test API</button>
    <div id="result"></div>
    
    <script>
        async function fetchData() {
            const response = await fetch('/api/hello');
            const data = await response.json();
            document.getElementById('result').innerHTML = JSON.stringify(data, null, 2);
        }
    </script>
</body>
</html>`,
        language: 'html',
        path: 'templates/index.html'
      }
    };
  }

  private generateJavaTemplate(prompt: string): Record<string, { content: string; language: string; path: string }> {
    return {
      'pom.xml': {
        content: `<?xml version="1.0" encoding="UTF-8"?>
<project xmlns="http://maven.apache.org/POM/4.0.0"
         xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
         xsi:schemaLocation="http://maven.apache.org/POM/4.0.0 
         http://maven.apache.org/xsd/maven-4.0.0.xsd">
    <modelVersion>4.0.0</modelVersion>
    <groupId>com.example</groupId>
    <artifactId>java-app</artifactId>
    <version>1.0-SNAPSHOT</version>
    <properties>
        <maven.compiler.source>17</maven.compiler.source>
        <maven.compiler.target>17</maven.compiler.target>
    </properties>
</project>`,
        language: 'xml',
        path: 'pom.xml'
      },
      'src/main/java/Main.java': {
        content: `public class Main {
    public static void main(String[] args) {
        System.out.println("Java Application");
        System.out.println("Generated based on: ${prompt}");
        
        // Your application logic here
        Application app = new Application();
        app.run();
    }
}

class Application {
    public void run() {
        System.out.println("Application is running!");
    }
}`,
        language: 'java',
        path: 'src/main/java/Main.java'
      }
    };
  }

  private generateNodeTemplate(prompt: string): Record<string, { content: string; language: string; path: string }> {
    return {
      'package.json': {
        content: JSON.stringify({
          "name": "node-app",
          "version": "1.0.0",
          "description": "Node.js application",
          "main": "server.js",
          "scripts": {
            "start": "node server.js",
            "dev": "nodemon server.js"
          },
          "dependencies": {
            "express": "^4.18.2",
            "cors": "^2.8.5"
          },
          "devDependencies": {
            "nodemon": "^3.0.1"
          }
        }, null, 2),
        language: 'json',
        path: 'package.json'
      },
      'server.js': {
        content: `const express = require('express');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

app.get('/', (req, res) => {
    res.json({
        message: 'Node.js Server Running',
        prompt: '${prompt}',
        timestamp: new Date().toISOString()
    });
});

app.listen(PORT, '0.0.0.0', () => {
    console.log(\`Server running on port \${PORT}\`);
});`,
        language: 'javascript',
        path: 'server.js'
      }
    };
  }

  private generateHTMLTemplate(prompt: string): Record<string, { content: string; language: string; path: string }> {
    return {
      'index.html': {
        content: `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Web Application</title>
    <link rel="stylesheet" href="style.css">
</head>
<body>
    <div class="container">
        <h1>Web Application</h1>
        <p>Generated based on: ${prompt}</p>
        <button onclick="handleClick()">Click Me</button>
        <div id="output"></div>
    </div>
    <script src="script.js"></script>
</body>
</html>`,
        language: 'html',
        path: 'index.html'
      },
      'style.css': {
        content: `* {
    margin: 0;
    padding: 0;
    box-sizing: border-box;
}

body {
    font-family: Arial, sans-serif;
    line-height: 1.6;
    color: #333;
    background: #f4f4f4;
}

.container {
    max-width: 800px;
    margin: 0 auto;
    padding: 20px;
    background: white;
    border-radius: 10px;
    margin-top: 50px;
    box-shadow: 0 0 10px rgba(0,0,0,0.1);
}

button {
    background: #007bff;
    color: white;
    border: none;
    padding: 10px 20px;
    border-radius: 5px;
    cursor: pointer;
    font-size: 16px;
}

button:hover {
    background: #0056b3;
}

#output {
    margin-top: 20px;
    padding: 10px;
    background: #e9ecef;
    border-radius: 5px;
}`,
        language: 'css',
        path: 'style.css'
      },
      'script.js': {
        content: `function handleClick() {
    const output = document.getElementById('output');
    output.innerHTML = \`
        <h3>Button clicked!</h3>
        <p>Time: \${new Date().toLocaleString()}</p>
        <p>This application was generated based on: ${prompt}</p>
    \`;
}

// Add more interactive functionality here
document.addEventListener('DOMContentLoaded', function() {
    console.log('Application loaded successfully');
});`,
        language: 'javascript',
        path: 'script.js'
      }
    };
  }

  private generateCSharpTemplate(prompt: string): Record<string, { content: string; language: string; path: string }> {
    return {
      'Program.cs': {
        content: `using System;

namespace CSharpApp
{
    class Program
    {
        static void Main(string[] args)
        {
            Console.WriteLine("C# Application");
            Console.WriteLine($"Generated based on: ${prompt}");
            
            var app = new Application();
            app.Run();
        }
    }
    
    public class Application
    {
        public void Run()
        {
            Console.WriteLine("Application is running!");
            // Add your application logic here
        }
    }
}`,
        language: 'csharp',
        path: 'Program.cs'
      },
      'CSharpApp.csproj': {
        content: `<Project Sdk="Microsoft.NET.Sdk">
  <PropertyGroup>
    <OutputType>Exe</OutputType>
    <TargetFramework>net6.0</TargetFramework>
    <Nullable>enable</Nullable>
  </PropertyGroup>
</Project>`,
        language: 'xml',
        path: 'CSharpApp.csproj'
      }
    };
  }

  private generateGoTemplate(prompt: string): Record<string, { content: string; language: string; path: string }> {
    return {
      'go.mod': {
        content: `module go-app

go 1.21`,
        language: 'text',
        path: 'go.mod'
      },
      'main.go': {
        content: `package main

import (
    "fmt"
    "net/http"
    "log"
)

func main() {
    fmt.Println("Go Application")
    fmt.Printf("Generated based on: ${prompt}\\n")
    
    http.HandleFunc("/", homeHandler)
    http.HandleFunc("/api/hello", apiHandler)
    
    fmt.Println("Server starting on :8080")
    log.Fatal(http.ListenAndServe(":8080", nil))
}

func homeHandler(w http.ResponseWriter, r *http.Request) {
    fmt.Fprintf(w, "Go Web Server Running\\nGenerated based on: ${prompt}")
}

func apiHandler(w http.ResponseWriter, r *http.Request) {
    w.Header().Set("Content-Type", "application/json")
    fmt.Fprintf(w, "{\\"message\\": \\"Hello from Go!\\", \\"prompt\\": \\"%s\\"}", "${prompt}")
}`,
        language: 'go',
        path: 'main.go'
      }
    };
  }

  private generateRustTemplate(prompt: string): Record<string, { content: string; language: string; path: string }> {
    return {
      'Cargo.toml': {
        content: `[package]
name = "rust-app"
version = "0.1.0"
edition = "2021"

[dependencies]`,
        language: 'toml',
        path: 'Cargo.toml'
      },
      'src/main.rs': {
        content: `fn main() {
    println!("Rust Application");
    println!("Generated based on: ${prompt}");
    
    let app = Application::new();
    app.run();
}

struct Application {
    name: String,
}

impl Application {
    fn new() -> Self {
        Application {
            name: "Rust App".to_string(),
        }
    }
    
    fn run(&self) {
        println!("Application {} is running!", self.name);
    }
}`,
        language: 'rust',
        path: 'src/main.rs'
      }
    };
  }

  private generatePHPTemplate(prompt: string): Record<string, { content: string; language: string; path: string }> {
    return {
      'index.php': {
        content: `<?php
echo "<h1>PHP Application</h1>";
echo "<p>Generated based on: ${prompt}</p>";

// Simple routing
$request = $_SERVER['REQUEST_URI'];

switch ($request) {
    case '/':
    case '':
        home();
        break;
    case '/api':
        api();
        break;
    default:
        http_response_code(404);
        echo "<h1>404 Not Found</h1>";
        break;
}

function home() {
    echo "<h2>Welcome to PHP App</h2>";
    echo "<a href='/api'>Test API</a>";
}

function api() {
    header('Content-Type: application/json');
    echo json_encode([
        'message' => 'Hello from PHP!',
        'prompt' => '${prompt}',
        'timestamp' => date('Y-m-d H:i:s')
    ]);
}
?>`,
        language: 'php',
        path: 'index.php'
      }
    };
  }

  private generateFlutterTemplate(prompt: string): Record<string, { content: string; language: string; path: string }> {
    return {
      'pubspec.yaml': {
        content: `name: flutter_app
description: A new Flutter project.
version: 1.0.0+1

environment:
  sdk: '>=3.0.0 <4.0.0'

dependencies:
  flutter:
    sdk: flutter
  cupertino_icons: ^1.0.2

dev_dependencies:
  flutter_test:
    sdk: flutter

flutter:
  uses-material-design: true`,
        language: 'yaml',
        path: 'pubspec.yaml'
      },
      'lib/main.dart': {
        content: `import 'package:flutter/material.dart';

void main() {
  runApp(MyApp());
}

class MyApp extends StatelessWidget {
  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'Flutter App',
      theme: ThemeData(
        primarySwatch: Colors.blue,
      ),
      home: MyHomePage(),
    );
  }
}

class MyHomePage extends StatefulWidget {
  @override
  _MyHomePageState createState() => _MyHomePageState();
}

class _MyHomePageState extends State<MyHomePage> {
  int _counter = 0;

  void _incrementCounter() {
    setState(() {
      _counter++;
    });
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: Text('Flutter Application'),
      ),
      body: Center(
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: <Widget>[
            Text('Generated based on:'),
            Text('${prompt}', style: Theme.of(context).textTheme.headline6),
            Text('You have pushed the button this many times:'),
            Text('\$_counter', style: Theme.of(context).textTheme.headline4),
          ],
        ),
      ),
      floatingActionButton: FloatingActionButton(
        onPressed: _incrementCounter,
        tooltip: 'Increment',
        child: Icon(Icons.add),
      ),
    );
  }
}`,
        language: 'dart',
        path: 'lib/main.dart'
      }
    };
  }

  private generateGenericTemplate(language: string, prompt: string): Record<string, { content: string; language: string; path: string }> {
    const ext = this.languageConfigs[language]?.ext || '.txt';
    
    return {
      [`main${ext}`]: {
        content: `// ${language.toUpperCase()} Application
// Generated based on: ${prompt}

// Add your ${language} code here
console.log("Hello from ${language}!");`,
        language: language,
        path: `main${ext}`
      },
      'README.md': {
        content: `# ${language.toUpperCase()} Application

Generated based on: ${prompt}

## Setup
1. Install dependencies
2. Run the application

## Usage
This is a ${language} application that implements the requested functionality.`,
        language: 'markdown',
        path: 'README.md'
      }
    };
  }

  private extractFilesFromResponse(response: string): Record<string, { content: string; language: string; path: string }> {
    const files: Record<string, { content: string; language: string; path: string }> = {};
    
    // Enhanced regex to match various code block formats
    const codeBlockRegex = /```(?:filename:(.+?)\n|(\w+)\n|(\w+):(.+?)\n)?([\s\S]*?)```/g;
    let match;
    
    while ((match = codeBlockRegex.exec(response)) !== null) {
      let filename = match[1] || match[4];
      let language = match[2] || match[3];
      let content = match[5];
      
      if (!filename && language) {
        // Generate filename based on language
        const ext = this.getExtensionForLanguage(language);
        filename = `main${ext}`;
      }
      
      if (filename && content) {
        // Clean up content
        content = content.trim();
        
        // Detect language from filename if not specified
        if (!language) {
          language = this.detectLanguageFromFilename(filename);
        }
        
        files[filename] = {
          content,
          language: language || 'text',
          path: filename
        };
      }
    }
    
    // If no files were extracted, try simpler patterns
    if (Object.keys(files).length === 0) {
      // Try to extract any code blocks
      const simpleCodeRegex = /```[\s\S]*?```/g;
      const matches = response.match(simpleCodeRegex);
      
      if (matches) {
        matches.forEach((match, index) => {
          const content = match.replace(/```[\w]*\n?/g, '').trim();
          files[`file${index + 1}.txt`] = {
            content,
            language: 'text',
            path: `file${index + 1}.txt`
          };
        });
      }
    }
    
    return files;
  }

  private getExtensionForLanguage(language: string): string {
    const extensions: Record<string, string> = {
      'javascript': '.js',
      'typescript': '.ts',
      'python': '.py',
      'java': '.java',
      'csharp': '.cs',
      'cpp': '.cpp',
      'c': '.c',
      'go': '.go',
      'rust': '.rs',
      'php': '.php',
      'ruby': '.rb',
      'swift': '.swift',
      'kotlin': '.kt',
      'dart': '.dart',
      'html': '.html',
      'css': '.css',
      'json': '.json',
      'xml': '.xml',
      'yaml': '.yaml',
      'markdown': '.md',
      'sql': '.sql',
      'r': '.R'
    };
    
    return extensions[language.toLowerCase()] || '.txt';
  }

  private detectLanguageFromFilename(filename: string): string {
    const ext = path.extname(filename).toLowerCase();
    const langMap: Record<string, string> = {
      '.js': 'javascript',
      '.ts': 'typescript',
      '.tsx': 'typescript',
      '.jsx': 'javascript',
      '.py': 'python',
      '.java': 'java',
      '.cs': 'csharp',
      '.cpp': 'cpp',
      '.c': 'c',
      '.go': 'go',
      '.rs': 'rust',
      '.php': 'php',
      '.rb': 'ruby',
      '.swift': 'swift',
      '.kt': 'kotlin',
      '.dart': 'dart',
      '.html': 'html',
      '.css': 'css',
      '.json': 'json',
      '.xml': 'xml',
      '.yaml': 'yaml',
      '.yml': 'yaml',
      '.md': 'markdown',
      '.sql': 'sql',
      '.r': 'r'
    };
    
    return langMap[ext] || 'text';
  }

  private async saveProjectFiles(projectPath: string, files: Record<string, { content: string; language: string; path: string }>): Promise<Record<string, { content: string; language: string; path: string }>> {
    const savedFiles: Record<string, { content: string; language: string; path: string }> = {};
    
    for (const [filename, fileData] of Object.entries(files)) {
      try {
        const filePath = path.join(projectPath, fileData.path);
        const dirPath = path.dirname(filePath);
        
        // Create directory if it doesn't exist
        await fs.mkdir(dirPath, { recursive: true });
        
        // Save file
        await fs.writeFile(filePath, fileData.content, 'utf-8');
        
        savedFiles[filename] = fileData;
        console.log(`✅ Saved: ${fileData.path}`);
      } catch (error) {
        console.error(`❌ Failed to save ${filename}:`, error);
      }
    }
    
    return savedFiles;
  }

  private async setupProject(projectPath: string, language: string): Promise<string[]> {
    const terminalOutput: string[] = [];
    const langConfig = this.languageConfigs[language];
    
    if (!langConfig?.buildCmd) {
      return [`No setup required for ${language}`];
    }
    
    return new Promise((resolve) => {
      const setupCommands = this.getSetupCommands(language);
      
      if (setupCommands.length === 0) {
        resolve([`No setup commands for ${language}`]);
        return;
      }
      
      // Execute setup commands sequentially
      this.executeCommandsSequentially(setupCommands, projectPath, terminalOutput)
        .then(() => resolve(terminalOutput))
        .catch((error) => {
          terminalOutput.push(`Setup failed: ${error.message}`);
          resolve(terminalOutput);
        });
    });
  }

  private getSetupCommands(language: string): string[] {
    const commands: Record<string, string[]> = {
      'react': ['npm install'],
      'node': ['npm install'],
      'typescript': ['npm install'],
      'python': ['pip install -r requirements.txt'],
      'java': ['mvn compile'],
      'csharp': ['dotnet restore'],
      'go': ['go mod tidy'],
      'rust': ['cargo build'],
      'flutter': ['flutter pub get'],
      'php': ['composer install']
    };
    
    return commands[language] || [];
  }

  private async executeCommandsSequentially(commands: string[], cwd: string, output: string[]): Promise<void> {
    for (const command of commands) {
      await this.executeCommand(command, cwd, output);
    }
  }

  private async executeCommand(command: string, cwd: string, output: string[]): Promise<void> {
    return new Promise((resolve, reject) => {
      output.push(`$ ${command}`);
      
      const process = exec(command, { cwd }, (error, stdout, stderr) => {
        if (stdout) output.push(stdout);
        if (stderr) output.push(stderr);
        
        if (error) {
          output.push(`Error: ${error.message}`);
          reject(error);
        } else {
          resolve();
        }
      });
      
      // Timeout after 60 seconds
      setTimeout(() => {
        process.kill();
        output.push('Command timed out after 60 seconds');
        resolve(); // Don't reject, just continue
      }, 60000);
    });
  }

  private async startPreviewServer(projectId: string, projectPath: string, language: string): Promise<string | undefined> {
    const langConfig = this.languageConfigs[language];
    
    if (!langConfig?.runCmd || !langConfig.port) {
      return undefined;
    }
    
    const port = this.basePort + this.previewServers.size;
    
    return new Promise((resolve) => {
      const runCommand = langConfig.runCmd.replace('3000', port.toString());
      
      const process = spawn('bash', ['-c', runCommand], {
        cwd: projectPath,
        stdio: 'pipe'
      });
      
      const server: PreviewServer = {
        id: projectId,
        port,
        process,
        projectPath,
        language
      };
      
      this.previewServers.set(projectId, server);
      
      // Wait for server to start
      setTimeout(() => {
        const previewUrl = `http://localhost:${port}`;
        console.log(`🌐 Preview server started: ${previewUrl}`);
        resolve(previewUrl);
      }, 3000);
      
      process.stdout?.on('data', (data) => {
        console.log(`[${language}:${port}] ${data.toString()}`);
      });
      
      process.stderr?.on('data', (data) => {
        console.error(`[${language}:${port}] ${data.toString()}`);
      });
    });
  }

  async stopPreviewServer(projectId: string): Promise<void> {
    const server = this.previewServers.get(projectId);
    if (server) {
      server.process.kill();
      this.previewServers.delete(projectId);
      console.log(`🛑 Stopped preview server for ${projectId}`);
    }
  }

  async runTerminalCommand(command: string, projectPath: string): Promise<string[]> {
    const output: string[] = [];
    
    return new Promise((resolve) => {
      this.executeCommand(command, projectPath, output)
        .then(() => resolve(output))
        .catch(() => resolve(output));
    });
  }

  getActiveServers(): Array<{ id: string; port: number; url: string; language: string }> {
    return Array.from(this.previewServers.values()).map(server => ({
      id: server.id,
      port: server.port,
      url: `http://localhost:${server.port}`,
      language: server.language
    }));
  }
}

export const comprehensiveAI = new ComprehensiveAIService();
export { ComprehensiveAIService };
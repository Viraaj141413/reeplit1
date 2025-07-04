import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  SparklesIcon, 
  UserIcon, 
  LogOutIcon, 
  CheckIcon, 
  BriefcaseIcon, 
  HeartIcon, 
  FolderIcon,
  ArrowRightIcon,
  CodeIcon,
  DatabaseIcon,
  GlobeIcon,
  SmartphoneIcon,
  ZapIcon,
  RocketIcon,
  TrendingUpIcon,
  PlayIcon,
  PlusIcon,
  StarIcon,
  ClockIcon,
  BrainIcon,
  LayersIcon,
  ShieldIcon,
  CloudIcon,
  TerminalIcon,
  PaletteIcon,
  ActivityIcon,
  BoxIcon
} from 'lucide-react';
import { AuthModal } from '@/components/auth-modal';

interface User {
  id: string;
  name: string;
  email: string;
}

interface RecentApp {
  id: string;
  name: string;
  description: string;
  type: string;
  createdAt: string;
  isPublic: boolean;
}

interface LandingPageProps {
  onCreateApp: (prompt: string, type: string) => void;
}

export function LandingPage({ onCreateApp }: LandingPageProps) {
  const [user, setUser] = useState<User | null>(null);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [inputValue, setInputValue] = useState('');
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [recentApps, setRecentApps] = useState<RecentApp[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const projectTemplates = [
    { 
      id: 'webapp', 
      label: 'Web Application', 
      icon: GlobeIcon, 
      description: 'Full-stack web applications',
      prompt: 'Create a modern web application with user authentication, database integration, and responsive design',
      gradient: 'from-blue-500 to-cyan-500',
      featured: true
    },
    { 
      id: 'mobile', 
      label: 'Mobile App', 
      icon: SmartphoneIcon, 
      description: 'Mobile-first experiences',
      prompt: 'Build a mobile-responsive app with touch interfaces, progressive web app features, and offline capabilities',
      gradient: 'from-purple-500 to-pink-500',
      featured: true
    },
    { 
      id: 'api', 
      label: 'API & Backend', 
      icon: DatabaseIcon, 
      description: 'Server-side applications',
      prompt: 'Create a RESTful API with database connections, authentication, and comprehensive endpoints',
      gradient: 'from-green-500 to-emerald-500',
      featured: true
    },
    { 
      id: 'dashboard', 
      label: 'Analytics Dashboard', 
      icon: TrendingUpIcon, 
      description: 'Data visualization',
      prompt: 'Build an analytics dashboard with real-time charts, data tables, and interactive visualizations',
      gradient: 'from-orange-500 to-red-500',
      featured: false
    },
    { 
      id: 'ecommerce', 
      label: 'E-commerce Store', 
      icon: BriefcaseIcon, 
      description: 'Online marketplace',
      prompt: 'Create an e-commerce platform with product catalog, shopping cart, and payment integration',
      gradient: 'from-indigo-500 to-purple-500',
      featured: false
    },
    { 
      id: 'portfolio', 
      label: 'Portfolio Site', 
      icon: UserIcon, 
      description: 'Personal showcase',
      prompt: 'Build a professional portfolio website showcasing projects, skills, and experience with elegant design',
      gradient: 'from-teal-500 to-blue-500',
      featured: false
    }
  ];

  const quickStarters = [
    'Landing page for a SaaS product',
    'Todo app with real-time sync',
    'Social media dashboard',
    'Weather application',
    'Blog with CMS',
    'Calculator app',
    'Chat application',
    'Image gallery'
  ];

  useEffect(() => {
    checkAuth();
    if (user) {
      loadRecentApps();
    }
  }, [user]);

  const checkAuth = async () => {
    try {
      const response = await fetch('/api/auth/me');
      if (response.ok) {
        const data = await response.json();
        setUser(data.user);
      }
    } catch (error) {
      console.error('Auth check failed:', error);
    }
  };

  const loadRecentApps = async () => {
    if (!user) return;

    try {
      // Get user projects from VIRAAJDATA system
      const response = await fetch(`/api/viraaj/user-projects?userId=${user.id}`);
      if (response.ok) {
        const data = await response.json();
        if (data.success && data.projects) {
          const recentProjects = data.projects.map((project: any) => ({
            id: project.id || Date.now().toString(),
            name: project.name || 'Untitled App',
            description: project.description || 'No description available',
            type: project.type || 'general',
            createdAt: project.createdAt || new Date().toISOString(),
            isPublic: true
          }));
          setRecentApps(recentProjects.slice(0, 6));
        }
      }
    } catch (error) {
      console.error('Failed to load recent apps:', error);
    }
  };

  const handleAuth = (userData: User) => {
    setUser(userData);
    setShowAuthModal(false);
  };

  const handleLogout = async () => {
    try {
      await fetch('/api/viraaj/logout', { method: 'POST' });
      setUser(null);
      setRecentApps([]);
    } catch (error) {
      console.error('Logout error:', error);
    }
  };

  const handleTemplateClick = (templateId: string) => {
    const template = projectTemplates.find(t => t.id === templateId);
    if (template) {
      setInputValue(template.prompt);
      setSelectedTags([templateId]);
    }
  };

  const handleQuickStartClick = (quickStart: string) => {
    setInputValue(quickStart);
    setSelectedTags([]);
  };

  const handleSubmit = () => {
    if (!user) {
      setShowAuthModal(true);
      return;
    }

    if (!inputValue.trim()) return;

    const appType = selectedTags.length > 0 ? selectedTags[0] : 'general';
    onCreateApp(inputValue, appType);
  };

  return (
    <div className="min-h-screen bg-[#0d1117] text-white flex flex-col">
      {/* Header */}
      <div className="bg-[#161b22] border-b border-gray-700 p-4">
        <div className="max-w-6xl mx-auto flex justify-between items-center">
          <div className="flex items-center space-x-2">
            <SparklesIcon className="w-6 h-6 text-blue-400" />
            <span className="text-xl font-bold">Peaks</span>
          </div>

          <div className="flex items-center space-x-3">
            {user ? (
              <>
                <div className="flex items-center space-x-2 text-sm">
                  <UserIcon className="w-4 h-4" />
                  <span>Hi, {user.name}</span>
                </div>
                <Button
                  onClick={handleLogout}
                  variant="ghost"
                  size="sm"
                  className="text-gray-400 hover:text-white"
                >
                  <LogOutIcon className="w-4 h-4" />
                </Button>
              </>
            ) : (
              <Button
                onClick={() => setShowAuthModal(true)}
                className="bg-blue-600 hover:bg-blue-700"
              >
                Sign in
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col items-center justify-center px-4 -mt-20">
        <div className="w-full max-w-2xl space-y-8">
          {/* Main Heading */}
          <div className="text-center space-y-4">
            <h1 className="text-4xl font-bold text-white">
              Hi {user ? user.name : ''}, what do you want to make today?
            </h1>
            <p className="text-gray-400 text-lg">
              Describe an app or site you want to create...
            </p>
          </div>

          {/* Input Section */}
          <div className="space-y-4">
            <div className="relative">
              <Textarea
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                placeholder="Describe an app or site you want to create..."
                className="w-full min-h-[120px] bg-[#21262d] border-gray-600 text-white placeholder-gray-400 resize-none text-base p-4 rounded-lg"
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleSubmit();
                  }
                }}
              />
              <div className="absolute bottom-3 left-3 text-xs text-gray-500 flex items-center space-x-2">
                <SparklesIcon className="w-3 h-3" />
                <span>AI from AIs</span>
                <span>•</span>
                <span>⌘</span>
              </div>
              <Button
                onClick={handleSubmit}
                disabled={!inputValue.trim() || isLoading}
                className="absolute bottom-3 right-3 bg-blue-600 hover:bg-blue-700 px-6"
              >
                Generate
              </Button>
            </div>

            {/* Project Templates */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mt-6">
              {projectTemplates.filter(template => template.featured).map(template => {
                const IconComponent = template.icon;
                return (
                  <Card
                    key={template.id}
                    onClick={() => handleTemplateClick(template.id)}
                    className={`cursor-pointer transition-all duration-200 hover:scale-105 ${
                      selectedTags.includes(template.id)
                        ? 'bg-gradient-to-r ' + template.gradient + ' text-white border-transparent'
                        : 'bg-[#161b22] border-gray-700 hover:border-gray-600'
                    }`}
                  >
                    <CardContent className="p-6 text-center">
                      <div className="flex flex-col items-center space-y-3">
                        <div className={`p-3 rounded-full ${
                          selectedTags.includes(template.id) 
                            ? 'bg-white/20' 
                            : 'bg-gradient-to-r ' + template.gradient
                        }`}>
                          <IconComponent className={`w-6 h-6 ${
                            selectedTags.includes(template.id) ? 'text-white' : 'text-white'
                          }`} />
                        </div>
                        <div>
                          <h3 className="font-semibold text-sm">{template.label}</h3>
                          <p className={`text-xs mt-1 ${
                            selectedTags.includes(template.id) ? 'text-white/80' : 'text-gray-400'
                          }`}>
                            {template.description}
                          </p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>

            {/* Quick Starters */}
            <div className="mt-6">
              <h3 className="text-sm font-medium text-gray-300 mb-3">Quick starters</h3>
              <div className="flex flex-wrap gap-2">
                {quickStarters.slice(0, 4).map((starter, index) => (
                  <Button
                    key={index}
                    onClick={() => handleQuickStartClick(starter)}
                    variant="outline"
                    size="sm"
                    className="border-gray-600 hover:border-blue-400 bg-transparent text-gray-300 hover:text-white text-xs"
                  >
                    {starter}
                  </Button>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Recent Apps Section */}
      {user && (
        <div className="bg-[#0d1117] px-4 pb-12">
          <div className="max-w-6xl mx-auto">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-semibold text-white">Your recent Apps</h2>
              <Button variant="ghost" size="sm" className="text-blue-400 hover:text-blue-300">
                View All →
              </Button>
            </div>

            {recentApps.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {recentApps.map((app) => (
                  <Card key={app.id} className="bg-[#161b22] border-gray-700 hover:border-gray-600 transition-colors cursor-pointer">
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between mb-2">
                        <div className="flex items-center space-x-2">
                          <div className="w-8 h-8 bg-blue-600 rounded flex items-center justify-center text-xs font-bold">
                            {app.name.charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <h3 className="font-medium text-white truncate">{app.name}</h3>
                            <p className="text-xs text-gray-400">{new Date(app.createdAt).toLocaleDateString()}</p>
                          </div>
                        </div>
                        <div className="flex items-center space-x-1">
                          <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                          <span className="text-xs text-gray-400">Public</span>
                        </div>
                      </div>
                      <p className="text-sm text-gray-300 line-clamp-2">{app.description}</p>
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : (
              <div className="text-center py-12">
                <FolderIcon className="w-12 h-12 text-gray-600 mx-auto mb-4" />
                <p className="text-gray-400">No recent apps yet. Create your first app above!</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Auth Modal */}
      <AuthModal
        isOpen={showAuthModal}
        onClose={() => setShowAuthModal(false)}
        onSuccess={handleAuth}
      />
    </div>
  );
}
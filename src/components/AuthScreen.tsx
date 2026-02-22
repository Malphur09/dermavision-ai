import { useState } from 'react';
import { Activity, Lock, Mail, User, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';

interface AuthScreenProps {
  onLogin: (role: 'doctor' | 'admin') => void;
}

export function AuthScreen({ onLogin }: AuthScreenProps) {
  const [loginType, setLoginType] = useState<'doctor' | 'admin'>('doctor');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState<{ email?: string; password?: string }>({});
  const [isLoading, setIsLoading] = useState(false);

  const validateForm = () => {
    const newErrors: { email?: string; password?: string } = {};
    
    if (!email.trim()) {
      newErrors.email = 'Email is required';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      newErrors.email = 'Please enter a valid email address';
    }
    
    if (!password.trim()) {
      newErrors.password = 'Password is required';
    } else if (password.length < 6) {
      newErrors.password = 'Password must be at least 6 characters';
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm()) {
      toast.error('Please fix the errors before submitting');
      return;
    }
    
    setIsLoading(true);
    
    // Simulate API call
    setTimeout(() => {
      // Mock authentication - check for demo credentials
      const validCredentials = 
        (email === 'doctor@medical.com' && password === 'demo123') ||
        (email === 'admin@medical.com' && password === 'admin123');
      
      if (validCredentials) {
        toast.success(`Welcome back! Logged in as ${loginType}`);
        onLogin(loginType);
      } else {
        toast.error('Invalid credentials. Try doctor@medical.com / demo123');
        setErrors({ 
          email: 'Invalid email or password',
          password: 'Invalid email or password'
        });
      }
      setIsLoading(false);
    }, 1000);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-teal-50 dark:from-gray-900 dark:to-gray-800 px-4">
      <div className="w-full max-w-md">
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl p-8">
          <div className="flex flex-col items-center mb-8">
            <div className="bg-teal-600 dark:bg-teal-500 rounded-full p-3 mb-4">
              <Activity className="h-12 w-12 text-white" />
            </div>
            <h1 className="text-gray-900 dark:text-white mb-2">
              Dermatologist Login
            </h1>
            <p className="text-sm text-gray-600 dark:text-gray-400 text-center">
              Skin Lesion Classification Diagnostic Tool
            </p>
          </div>

          <div className="mb-6">
            <div className="flex bg-gray-100 dark:bg-gray-700 rounded-lg p-1">
              <button
                type="button"
                onClick={() => setLoginType('doctor')}
                className={`flex-1 py-2 px-4 rounded-md text-sm transition-colors ${
                  loginType === 'doctor'
                    ? 'bg-white dark:bg-gray-600 text-teal-700 dark:text-teal-300 shadow-sm'
                    : 'text-gray-600 dark:text-gray-400'
                }`}
              >
                <User className="h-4 w-4 inline mr-2" />
                Doctor/User
              </button>
              <button
                type="button"
                onClick={() => setLoginType('admin')}
                className={`flex-1 py-2 px-4 rounded-md text-sm transition-colors ${
                  loginType === 'admin'
                    ? 'bg-white dark:bg-gray-600 text-teal-700 dark:text-teal-300 shadow-sm'
                    : 'text-gray-600 dark:text-gray-400'
                }`}
              >
                <Lock className="h-4 w-4 inline mr-2" />
                Admin
              </button>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label htmlFor="email" className="block text-sm text-gray-700 dark:text-gray-300 mb-2">
                Username/Email
              </label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
                <input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value);
                    if (errors.email) setErrors({ ...errors, email: undefined });
                  }}
                  placeholder="Enter your email"
                  className={`w-full pl-10 pr-4 py-3 border rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 ${
                    errors.email 
                      ? 'border-red-500 focus:ring-red-500' 
                      : 'border-gray-300 dark:border-gray-600 focus:ring-teal-500 dark:focus:ring-teal-400'
                  }`}
                />
              </div>
              {errors.email && (
                <div className="mt-2 flex items-center text-sm text-red-600 dark:text-red-400">
                  <AlertCircle className="h-4 w-4 mr-1" />
                  {errors.email}
                </div>
              )}
            </div>

            <div>
              <label htmlFor="password" className="block text-sm text-gray-700 dark:text-gray-300 mb-2">
                Password
              </label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
                <input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value);
                    if (errors.password) setErrors({ ...errors, password: undefined });
                  }}
                  placeholder="Enter your password"
                  className={`w-full pl-10 pr-4 py-3 border rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 ${
                    errors.password 
                      ? 'border-red-500 focus:ring-red-500' 
                      : 'border-gray-300 dark:border-gray-600 focus:ring-teal-500 dark:focus:ring-teal-400'
                  }`}
                />
              </div>
              {errors.password && (
                <div className="mt-2 flex items-center text-sm text-red-600 dark:text-red-400">
                  <AlertCircle className="h-4 w-4 mr-1" />
                  {errors.password}
                </div>
              )}
            </div>

            <div className="flex items-center justify-between">
              <div className="flex items-center">
                <input
                  id="remember"
                  type="checkbox"
                  className="h-4 w-4 text-teal-600 focus:ring-teal-500 border-gray-300 rounded"
                />
                <label htmlFor="remember" className="ml-2 block text-sm text-gray-700 dark:text-gray-300">
                  Remember me
                </label>
              </div>
              <a href="#" className="text-sm text-teal-600 dark:text-teal-400 hover:text-teal-700 dark:hover:text-teal-300">
                Forgot Password?
              </a>
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full py-3 px-4 bg-teal-600 hover:bg-teal-700 dark:bg-teal-500 dark:hover:bg-teal-600 text-white rounded-lg transition-colors shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isLoading ? 'Logging in...' : 'Login'}
            </button>
          </form>

          <div className="mt-6 text-center">
            <p className="text-xs text-gray-500 dark:text-gray-400">
              Secure medical-grade authentication system
            </p>
            <p className="text-xs text-teal-600 dark:text-teal-400 mt-2">
              Demo: doctor@medical.com / demo123
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
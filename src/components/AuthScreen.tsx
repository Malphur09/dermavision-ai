import { useState } from 'react';
import { Activity, Lock, Mail, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';
import { createClient } from '@/lib/supabase/client';

interface AuthScreenProps {
  onLogin: (role: 'doctor' | 'admin') => void;
}

type Mode = 'login' | 'signup';

export function AuthScreen({ onLogin }: AuthScreenProps) {
  const [mode, setMode] = useState<Mode>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState<{ email?: string; password?: string }>({});
  const [isLoading, setIsLoading] = useState(false);
  const [confirmationSent, setConfirmationSent] = useState(false);

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

  const clearFieldError = (field: 'email' | 'password') => {
    if (errors[field]) {
      setErrors((prev) => {
        const next = { ...prev };
        delete next[field];
        return next;
      });
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) {
      toast.error('Please fix the errors before submitting');
      return;
    }

    setIsLoading(true);
    const supabase = createClient();

    try {
    if (mode === 'signup') {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: { role: 'doctor' },
        },
      });

      if (error) {
        toast.error(error.message);
        setIsLoading(false);
        return;
      }

      // If session is null, email confirmation is required
      if (!data.session) {
        setConfirmationSent(true);
        setIsLoading(false);
        return;
      }

      toast.success('Account created. Welcome!');
      onLogin('doctor');
    } else {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });

      if (error) {
        toast.error('Invalid email or password');
        setErrors({ email: ' ', password: 'Invalid email or password' });
        setIsLoading(false);
        return;
      }

      toast.success('Welcome back!');
      onLogin('doctor'); // AuthContext sets real role; middleware enforces admin routes
    }
    } catch (err) {
      console.error('Auth error:', err);
      toast.error('An unexpected error occurred. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  if (confirmationSent) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-teal-50 dark:from-gray-900 dark:to-gray-800 px-4">
        <div className="w-full max-w-md bg-white dark:bg-gray-800 rounded-lg shadow-xl p-8 text-center">
          <div className="bg-teal-600 dark:bg-teal-500 rounded-full p-3 mb-4 inline-flex">
            <Activity className="h-12 w-12 text-white" />
          </div>
          <h2 className="text-gray-900 dark:text-white mb-2">Check your email</h2>
          <p className="text-sm text-gray-600 dark:text-gray-400">
            Confirmation link sent to <strong>{email}</strong>. Click it to activate your account, then log in.
          </p>
          <button
            onClick={() => { setMode('login'); setConfirmationSent(false); }}
            className="mt-6 text-sm text-teal-600 dark:text-teal-400 hover:underline"
          >
            Back to login
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-teal-50 dark:from-gray-900 dark:to-gray-800 px-4">
      <div className="w-full max-w-md">
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl p-8">
          <div className="flex flex-col items-center mb-8">
            <div className="bg-teal-600 dark:bg-teal-500 rounded-full p-3 mb-4">
              <Activity className="h-12 w-12 text-white" />
            </div>
            <h1 className="text-gray-900 dark:text-white mb-2">
              {mode === 'login' ? 'Dermatologist Login' : 'Create Account'}
            </h1>
            <p className="text-sm text-gray-600 dark:text-gray-400 text-center">
              Skin Lesion Classification Diagnostic Tool
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label htmlFor="email" className="block text-sm text-gray-700 dark:text-gray-300 mb-2">
                Email
              </label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
                <input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => { setEmail(e.target.value); clearFieldError('email'); }}
                  placeholder="Enter your email"
                  className={`w-full pl-10 pr-4 py-3 border rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 ${
                    errors.email
                      ? 'border-red-500 focus:ring-red-500'
                      : 'border-gray-300 dark:border-gray-600 focus:ring-teal-500 dark:focus:ring-teal-400'
                  }`}
                />
              </div>
              {errors.email && errors.email.trim() && (
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
                  onChange={(e) => { setPassword(e.target.value); clearFieldError('password'); }}
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

            <button
              type="submit"
              disabled={isLoading}
              className="w-full py-3 px-4 bg-teal-600 hover:bg-teal-700 dark:bg-teal-500 dark:hover:bg-teal-600 text-white rounded-lg transition-colors shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isLoading
                ? mode === 'login' ? 'Logging in...' : 'Creating account...'
                : mode === 'login' ? 'Login' : 'Create Account'}
            </button>
          </form>

          <div className="mt-6 text-center">
            <p className="text-xs text-gray-500 dark:text-gray-400">
              Secure medical-grade authentication system
            </p>
            <button
              type="button"
              onClick={() => { setMode(mode === 'login' ? 'signup' : 'login'); setErrors({}); }}
              className="mt-3 text-sm text-teal-600 dark:text-teal-400 hover:underline"
            >
              {mode === 'login' ? "Don't have an account? Sign up" : 'Already have an account? Log in'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

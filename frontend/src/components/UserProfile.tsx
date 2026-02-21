import { useState } from 'react';
import { Save, Lock, Mail, User, Shield, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';

export function UserProfile() {
  const [name, setName] = useState('Dr. Sarah Johnson');
  const [email, setEmail] = useState('sarah.j@hospital.com');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [errors, setErrors] = useState<{ [key: string]: string }>({});
  const [isSaving, setIsSaving] = useState(false);

  const handleSaveProfile = (e: React.FormEvent) => {
    e.preventDefault();
    
    const newErrors: { [key: string]: string } = {};
    
    if (!name.trim()) {
      newErrors.name = 'Name is required';
    }
    
    if (!email.trim()) {
      newErrors.email = 'Email is required';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      newErrors.email = 'Please enter a valid email address';
    }
    
    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      toast.error('Please fix the errors before saving');
      return;
    }
    
    setIsSaving(true);
    
    // Simulate API call
    setTimeout(() => {
      toast.success('Profile updated successfully!');
      setIsSaving(false);
      setErrors({});
    }, 1000);
  };

  const handleChangePassword = (e: React.FormEvent) => {
    e.preventDefault();
    
    const newErrors: { [key: string]: string } = {};
    
    if (!currentPassword) {
      newErrors.currentPassword = 'Current password is required';
    }
    
    if (!newPassword) {
      newErrors.newPassword = 'New password is required';
    } else if (newPassword.length < 8) {
      newErrors.newPassword = 'Password must be at least 8 characters';
    } else if (!/(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/.test(newPassword)) {
      newErrors.newPassword = 'Password must contain uppercase, lowercase, and number';
    }
    
    if (!confirmPassword) {
      newErrors.confirmPassword = 'Please confirm your password';
    } else if (newPassword !== confirmPassword) {
      newErrors.confirmPassword = 'Passwords do not match';
    }
    
    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      toast.error('Please fix the errors before changing password');
      return;
    }
    
    // Simulate API call
    setTimeout(() => {
      toast.success('Password changed successfully!');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setErrors({});
    }, 1000);
  };

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="mb-8">
        <h1 className="text-gray-900 dark:text-white mb-2">
          User Profile & Security Settings
        </h1>
        <p className="text-gray-600 dark:text-gray-400">
          Manage your account information and security preferences
        </p>
      </div>

      <div className="space-y-6">
        {/* Profile Information */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700">
          <div className="p-6 border-b border-gray-200 dark:border-gray-700">
            <div className="flex items-center space-x-3">
              <User className="h-6 w-6 text-teal-600 dark:text-teal-400" />
              <h2 className="text-gray-900 dark:text-white">
                Profile Information
              </h2>
            </div>
          </div>

          <form onSubmit={handleSaveProfile} className="p-6 space-y-6">
            <div className="flex items-center space-x-6 mb-6">
              <div className="w-24 h-24 bg-teal-100 dark:bg-teal-900/30 rounded-full flex items-center justify-center">
                <User className="h-12 w-12 text-teal-600 dark:text-teal-400" />
              </div>
              <div>
                <button
                  type="button"
                  className="px-4 py-2 bg-teal-600 hover:bg-teal-700 dark:bg-teal-500 dark:hover:bg-teal-600 text-white rounded-lg transition-colors text-sm"
                >
                  Change Photo
                </button>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
                  JPG, PNG or GIF (Max 2MB)
                </p>
              </div>
            </div>

            <div>
              <label htmlFor="name" className="block text-sm text-gray-700 dark:text-gray-300 mb-2">
                Full Name
              </label>
              <input
                id="name"
                type="text"
                value={name}
                onChange={(e) => {
                  setName(e.target.value);
                  if (errors.name) setErrors({ ...errors, name: undefined });
                }}
                className={`w-full px-4 py-3 border rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 ${
                  errors.name 
                    ? 'border-red-500 focus:ring-red-500' 
                    : 'border-gray-300 dark:border-gray-600 focus:ring-teal-500 dark:focus:ring-teal-400'
                }`}
              />
              {errors.name && (
                <div className="mt-1 flex items-center text-sm text-red-600 dark:text-red-400">
                  <AlertCircle className="h-4 w-4 mr-1" />
                  {errors.name}
                </div>
              )}
            </div>

            <div>
              <label htmlFor="email" className="block text-sm text-gray-700 dark:text-gray-300 mb-2">
                Email Address
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
                  className={`w-full pl-10 pr-4 py-3 border rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 ${
                    errors.email 
                      ? 'border-red-500 focus:ring-red-500' 
                      : 'border-gray-300 dark:border-gray-600 focus:ring-teal-500 dark:focus:ring-teal-400'
                  }`}
                />
              </div>
              {errors.email && (
                <div className="mt-1 flex items-center text-sm text-red-600 dark:text-red-400">
                  <AlertCircle className="h-4 w-4 mr-1" />
                  {errors.email}
                </div>
              )}
            </div>

            <div>
              <label htmlFor="role" className="block text-sm text-gray-700 dark:text-gray-300 mb-2">
                Role
              </label>
              <input
                id="role"
                type="text"
                value="Doctor - Dermatology"
                disabled
                className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-gray-100 dark:bg-gray-700/50 text-gray-500 dark:text-gray-400"
              />
            </div>

            <div>
              <label htmlFor="department" className="block text-sm text-gray-700 dark:text-gray-300 mb-2">
                Department
              </label>
              <input
                id="department"
                type="text"
                value="Dermatology & Skin Cancer Center"
                disabled
                className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-gray-100 dark:bg-gray-700/50 text-gray-500 dark:text-gray-400"
              />
            </div>

            <button
              type="submit"
              className="flex items-center space-x-2 px-6 py-3 bg-teal-600 hover:bg-teal-700 dark:bg-teal-500 dark:hover:bg-teal-600 text-white rounded-lg transition-colors shadow-md"
            >
              <Save className="h-5 w-5" />
              <span>Save Changes</span>
            </button>
          </form>
        </div>

        {/* Security Settings */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700">
          <div className="p-6 border-b border-gray-200 dark:border-gray-700">
            <div className="flex items-center space-x-3">
              <Shield className="h-6 w-6 text-teal-600 dark:text-teal-400" />
              <h2 className="text-gray-900 dark:text-white">
                Security Settings
              </h2>
            </div>
          </div>

          <form onSubmit={handleChangePassword} className="p-6 space-y-6">
            <div>
              <label htmlFor="currentPassword" className="block text-sm text-gray-700 dark:text-gray-300 mb-2">
                Current Password
              </label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
                <input
                  id="currentPassword"
                  type="password"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  placeholder="Enter current password"
                  className="w-full pl-10 pr-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-teal-500 dark:focus:ring-teal-400"
                />
              </div>
              {errors.currentPassword && (
                <div className="mt-1 flex items-center text-sm text-red-600 dark:text-red-400">
                  <AlertCircle className="h-4 w-4 mr-1" />
                  {errors.currentPassword}
                </div>
              )}
            </div>

            <div>
              <label htmlFor="newPassword" className="block text-sm text-gray-700 dark:text-gray-300 mb-2">
                New Password
              </label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
                <input
                  id="newPassword"
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Enter new password"
                  className="w-full pl-10 pr-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-teal-500 dark:focus:ring-teal-400"
                />
              </div>
              {errors.newPassword && (
                <div className="mt-1 flex items-center text-sm text-red-600 dark:text-red-400">
                  <AlertCircle className="h-4 w-4 mr-1" />
                  {errors.newPassword}
                </div>
              )}
            </div>

            <div>
              <label htmlFor="confirmPassword" className="block text-sm text-gray-700 dark:text-gray-300 mb-2">
                Confirm New Password
              </label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
                <input
                  id="confirmPassword"
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Confirm new password"
                  className="w-full pl-10 pr-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-teal-500 dark:focus:ring-teal-400"
                />
              </div>
              {errors.confirmPassword && (
                <div className="mt-1 flex items-center text-sm text-red-600 dark:text-red-400">
                  <AlertCircle className="h-4 w-4 mr-1" />
                  {errors.confirmPassword}
                </div>
              )}
            </div>

            <div className="p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
              <p className="text-sm text-blue-800 dark:text-blue-300">
                <strong>Password Requirements:</strong> At least 8 characters, including uppercase, lowercase, numbers, and special characters.
              </p>
            </div>

            <button
              type="submit"
              className="flex items-center space-x-2 px-6 py-3 bg-blue-600 hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600 text-white rounded-lg transition-colors shadow-md"
            >
              <Lock className="h-5 w-5" />
              <span>Change Password</span>
            </button>
          </form>
        </div>

        {/* Account Activity */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700">
          <div className="p-6 border-b border-gray-200 dark:border-gray-700">
            <h2 className="text-gray-900 dark:text-white">
              Recent Activity
            </h2>
          </div>

          <div className="p-6">
            <div className="space-y-4">
              <div className="flex items-center justify-between py-3 border-b border-gray-100 dark:border-gray-700">
                <div>
                  <p className="text-sm text-gray-900 dark:text-gray-100">Last Login</p>
                  <p className="text-xs text-gray-600 dark:text-gray-400">IP: 192.168.1.105</p>
                </div>
                <p className="text-sm text-gray-600 dark:text-gray-400">2025-12-10 09:15 AM</p>
              </div>
              <div className="flex items-center justify-between py-3 border-b border-gray-100 dark:border-gray-700">
                <div>
                  <p className="text-sm text-gray-900 dark:text-gray-100">Profile Updated</p>
                  <p className="text-xs text-gray-600 dark:text-gray-400">Email address changed</p>
                </div>
                <p className="text-sm text-gray-600 dark:text-gray-400">2025-12-08 02:30 PM</p>
              </div>
              <div className="flex items-center justify-between py-3">
                <div>
                  <p className="text-sm text-gray-900 dark:text-gray-100">Password Changed</p>
                  <p className="text-xs text-gray-600 dark:text-gray-400">Security update</p>
                </div>
                <p className="text-sm text-gray-600 dark:text-gray-400">2025-12-01 11:45 AM</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
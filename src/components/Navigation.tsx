import { Moon, Sun, LogOut, Activity, Upload, FileText, Users, User, BarChart3, FolderOpen } from 'lucide-react';
import { useTheme } from '../contexts/ThemeContext';
import { Screen, UserRole } from '../App';
import { toast } from 'sonner';

interface NavigationProps {
  currentScreen: Screen;
  userRole: UserRole;
  onNavigate: (screen: Screen) => void;
  onLogout: () => void;
}

export function Navigation({ currentScreen, userRole, onNavigate, onLogout }: NavigationProps) {
  const { theme, toggleTheme } = useTheme();

  const handleLogout = () => {
    toast('Are you sure you want to logout?', {
      action: {
        label: 'Logout',
        onClick: () => {
          toast.success('Logged out successfully!');
          onLogout();
        },
      },
      cancel: {
        label: 'Cancel',
        onClick: () => {},
      },
    });
  };

  const doctorMenuItems = [
    { id: 'diagnostic' as Screen, label: 'New Diagnosis', icon: Upload },
    { id: 'results' as Screen, label: 'Results', icon: Activity },
    { id: 'records' as Screen, label: 'Patient Records', icon: FolderOpen },
    { id: 'report' as Screen, label: 'Export Report', icon: FileText },
    { id: 'profile' as Screen, label: 'Profile', icon: User },
  ];

  const adminMenuItems = [
    { id: 'admin' as Screen, label: 'System Management', icon: Users },
    { id: 'dashboard' as Screen, label: 'Activity Dashboard', icon: BarChart3 },
    { id: 'records' as Screen, label: 'Patient Records', icon: FolderOpen },
    { id: 'profile' as Screen, label: 'Profile', icon: User },
  ];

  const menuItems = userRole === 'admin' ? adminMenuItems : doctorMenuItems;

  return (
    <nav className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 shadow-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          <div className="flex items-center space-x-8">
            <div className="flex items-center space-x-2">
              <Activity className="h-8 w-8 text-teal-600 dark:text-teal-400" />
              <span className="text-gray-900 dark:text-white">
                Skin Lesion Diagnostic Tool
              </span>
            </div>
            <div className="hidden md:flex space-x-4">
              {menuItems.map((item) => {
                const Icon = item.icon;
                const isActive = currentScreen === item.id;
                return (
                  <button
                    key={item.id}
                    onClick={() => onNavigate(item.id)}
                    className={`flex items-center space-x-2 px-3 py-2 rounded-md transition-colors ${
                      isActive
                        ? 'bg-teal-50 dark:bg-teal-900/30 text-teal-700 dark:text-teal-300'
                        : 'text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
                    }`}
                  >
                    <Icon className="h-4 w-4" />
                    <span className="text-sm">{item.label}</span>
                  </button>
                );
              })}
            </div>
          </div>
          <div className="flex items-center space-x-4">
            <button
              onClick={toggleTheme}
              className="p-2 rounded-md text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
              aria-label="Toggle theme"
            >
              {theme === 'light' ? <Moon className="h-5 w-5" /> : <Sun className="h-5 w-5" />}
            </button>
            <button
              onClick={handleLogout}
              className="flex items-center space-x-2 px-4 py-2 rounded-md bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-900/30 transition-colors"
            >
              <LogOut className="h-4 w-4" />
              <span className="text-sm">Logout</span>
            </button>
          </div>
        </div>
      </div>
    </nav>
  );
}
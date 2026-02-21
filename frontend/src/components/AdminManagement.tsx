import { useState } from 'react';
import { UserPlus, Trash2, Upload, Play, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';

const mockUsers = [
  { id: 1, name: 'Dr. Sarah Johnson', email: 'sarah.j@hospital.com', role: 'Doctor', status: 'Active', lastLogin: '2025-12-10' },
  { id: 2, name: 'Dr. Michael Chen', email: 'michael.c@hospital.com', role: 'Doctor', status: 'Active', lastLogin: '2025-12-09' },
  { id: 3, name: 'Dr. Emily Rodriguez', email: 'emily.r@hospital.com', role: 'Doctor', status: 'Active', lastLogin: '2025-12-08' },
  { id: 4, name: 'Admin User', email: 'admin@hospital.com', role: 'Admin', status: 'Active', lastLogin: '2025-12-10' },
];

export function AdminManagement() {
  const [users] = useState(mockUsers);
  const [learningRate, setLearningRate] = useState('0.001');
  const [epochs, setEpochs] = useState('50');
  const [uploadedDataset, setUploadedDataset] = useState<File | null>(null);
  const [isTraining, setIsTraining] = useState(false);
  const [errors, setErrors] = useState<{ [key: string]: string }>({});

  const handleDatasetUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      
      // Validate file type
      if (!file.name.endsWith('.zip') && !file.name.endsWith('.tar.gz')) {
        toast.error('Invalid file type. Please upload .zip or .tar.gz files');
        return;
      }
      
      // Validate file size (max 500MB for dataset)
      const maxSize = 500 * 1024 * 1024;
      if (file.size > maxSize) {
        toast.error('File size exceeds 500MB limit');
        return;
      }
      
      setUploadedDataset(file);
      toast.success('Dataset uploaded successfully!');
    }
  };

  const handleAddUser = () => {
    toast.success('User creation modal would open here');
  };

  const handleDeleteUser = (userName: string) => {
    toast.error(`Delete user ${userName}? This action cannot be undone.`, {
      action: {
        label: 'Confirm',
        onClick: () => toast.success(`User ${userName} has been deactivated`),
      },
    });
  };

  const handleStartTraining = () => {
    const newErrors: { [key: string]: string } = {};
    
    if (!uploadedDataset) {
      newErrors.dataset = 'Please upload a training dataset first';
    }
    
    const lr = parseFloat(learningRate);
    if (isNaN(lr) || lr <= 0 || lr > 1) {
      newErrors.learningRate = 'Learning rate must be between 0 and 1';
    }
    
    const ep = parseInt(epochs);
    if (isNaN(ep) || ep < 1 || ep > 1000) {
      newErrors.epochs = 'Epochs must be between 1 and 1000';
    }
    
    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      toast.error('Please fix the errors before starting training');
      return;
    }
    
    setIsTraining(true);
    toast.loading('Initializing model training...');
    
    // Simulate training start
    setTimeout(() => {
      toast.dismiss();
      toast.success('Model training started successfully!');
      setIsTraining(false);
      setErrors({});
    }, 2000);
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="mb-8">
        <h1 className="text-gray-900 dark:text-white mb-2">
          System Model Management
        </h1>
        <p className="text-gray-600 dark:text-gray-400">
          Manage system users and AI model configuration
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Left Panel: Account Management */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700">
          <div className="p-6 border-b border-gray-200 dark:border-gray-700">
            <h2 className="text-gray-900 dark:text-white">
              Account Management
            </h2>
          </div>

          <div className="p-6">
            <div className="mb-4 flex space-x-3">
              <button className="flex items-center space-x-2 px-4 py-2 bg-teal-600 hover:bg-teal-700 dark:bg-teal-500 dark:hover:bg-teal-600 text-white rounded-lg transition-colors" onClick={handleAddUser}>
                <UserPlus className="h-4 w-4" />
                <span className="text-sm">Add New User</span>
              </button>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-200 dark:border-gray-700">
                    <th className="text-left py-3 px-2 text-xs text-gray-700 dark:text-gray-300">Name</th>
                    <th className="text-left py-3 px-2 text-xs text-gray-700 dark:text-gray-300">Email</th>
                    <th className="text-left py-3 px-2 text-xs text-gray-700 dark:text-gray-300">Role</th>
                    <th className="text-left py-3 px-2 text-xs text-gray-700 dark:text-gray-300">Status</th>
                    <th className="text-left py-3 px-2 text-xs text-gray-700 dark:text-gray-300">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map((user) => (
                    <tr key={user.id} className="border-b border-gray-100 dark:border-gray-700">
                      <td className="py-3 px-2 text-sm text-gray-900 dark:text-gray-100">{user.name}</td>
                      <td className="py-3 px-2 text-sm text-gray-600 dark:text-gray-400">{user.email}</td>
                      <td className="py-3 px-2">
                        <span className={`inline-block px-2 py-1 text-xs rounded ${
                          user.role === 'Admin'
                            ? 'bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300'
                            : 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300'
                        }`}>
                          {user.role}
                        </span>
                      </td>
                      <td className="py-3 px-2">
                        <span className="inline-block px-2 py-1 text-xs rounded bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300">
                          {user.status}
                        </span>
                      </td>
                      <td className="py-3 px-2">
                        <button className="p-1 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded transition-colors" onClick={() => handleDeleteUser(user.name)}>
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="mt-4 p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
              <p className="text-xs text-gray-600 dark:text-gray-400">
                <strong>Total Users:</strong> {users.length} • <strong>Active:</strong> {users.filter(u => u.status === 'Active').length}
              </p>
            </div>
          </div>
        </div>

        {/* Right Panel: Model Update */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700">
          <div className="p-6 border-b border-gray-200 dark:border-gray-700">
            <h2 className="text-gray-900 dark:text-white">
              Model Update
            </h2>
          </div>

          <div className="p-6 space-y-6">
            <div>
              <label className="block text-sm text-gray-700 dark:text-gray-300 mb-3">
                Upload New Model File
              </label>
              <div className="border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg p-6 text-center bg-gray-50 dark:bg-gray-700/50">
                <Upload className="h-12 w-12 mx-auto mb-3 text-gray-400 dark:text-gray-500" />
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
                  Upload trained model file
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-500 mb-3">
                  Supported formats: .h5, .pt, .pth (Max size: 500MB)
                </p>
                <input
                  type="file"
                  accept=".h5,.pt,.pth"
                  className="hidden"
                  id="model-upload"
                />
                <label
                  htmlFor="model-upload"
                  className="inline-block px-4 py-2 bg-gray-200 dark:bg-gray-600 text-gray-700 dark:text-gray-200 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-500 cursor-pointer transition-colors text-sm"
                >
                  Browse Files
                </label>
              </div>
            </div>

            <div className="border-t border-gray-200 dark:border-gray-700 pt-6">
              <h3 className="text-gray-900 dark:text-white mb-4">
                Training Configuration
              </h3>

              <div className="space-y-4">
                <div>
                  <label htmlFor="learningRate" className="block text-sm text-gray-700 dark:text-gray-300 mb-2">
                    Learning Rate
                  </label>
                  <input
                    id="learningRate"
                    type="text"
                    value={learningRate}
                    onChange={(e) => setLearningRate(e.target.value)}
                    placeholder="e.g., 0.001"
                    className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-teal-500 dark:focus:ring-teal-400"
                  />
                  {errors.learningRate && <p className="text-xs text-red-500 mt-1">{errors.learningRate}</p>}
                </div>

                <div>
                  <label htmlFor="epochs" className="block text-sm text-gray-700 dark:text-gray-300 mb-2">
                    Epochs
                  </label>
                  <input
                    id="epochs"
                    type="number"
                    value={epochs}
                    onChange={(e) => setEpochs(e.target.value)}
                    placeholder="e.g., 50"
                    className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-teal-500 dark:focus:ring-teal-400"
                  />
                  {errors.epochs && <p className="text-xs text-red-500 mt-1">{errors.epochs}</p>}
                </div>

                <div>
                  <label htmlFor="batchSize" className="block text-sm text-gray-700 dark:text-gray-300 mb-2">
                    Batch Size
                  </label>
                  <select
                    id="batchSize"
                    className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-teal-500 dark:focus:ring-teal-400"
                  >
                    <option value="16">16</option>
                    <option value="32">32</option>
                    <option value="64">64</option>
                    <option value="128">128</option>
                  </select>
                </div>

                <div>
                  <label htmlFor="optimizer" className="block text-sm text-gray-700 dark:text-gray-300 mb-2">
                    Optimizer
                  </label>
                  <select
                    id="optimizer"
                    className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-teal-500 dark:focus:ring-teal-400"
                  >
                    <option value="adam">Adam</option>
                    <option value="sgd">SGD</option>
                    <option value="rmsprop">RMSprop</option>
                  </select>
                </div>
              </div>
            </div>

            <button className="w-full flex items-center justify-center space-x-2 px-6 py-3 bg-teal-600 hover:bg-teal-700 dark:bg-teal-500 dark:hover:bg-teal-600 text-white rounded-lg transition-colors shadow-md" onClick={handleStartTraining} disabled={isTraining}>
              <Play className="h-5 w-5" />
              <span>Initiate Retraining</span>
            </button>

            <div className="p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
              <p className="text-xs text-blue-800 dark:text-blue-300">
                <strong>Note:</strong> Model retraining typically takes 2-4 hours depending on dataset size. The system will notify you upon completion.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Current Model Info */}
      <div className="mt-8 bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6 border border-gray-200 dark:border-gray-700">
        <h3 className="text-gray-900 dark:text-white mb-4">
          Current Model Information
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <div>
            <p className="text-xs text-gray-600 dark:text-gray-400 mb-1">Model Version</p>
            <p className="text-gray-900 dark:text-white">v2.3.1-ResNet50</p>
          </div>
          <div>
            <p className="text-xs text-gray-600 dark:text-gray-400 mb-1">Last Updated</p>
            <p className="text-gray-900 dark:text-white">2025-11-15</p>
          </div>
          <div>
            <p className="text-xs text-gray-600 dark:text-gray-400 mb-1">Validation Accuracy</p>
            <p className="text-gray-900 dark:text-white">94.2%</p>
          </div>
          <div>
            <p className="text-xs text-gray-600 dark:text-gray-400 mb-1">Training Dataset</p>
            <p className="text-gray-900 dark:text-white">HAM10000 (10,015 images)</p>
          </div>
        </div>
      </div>
    </div>
  );
}
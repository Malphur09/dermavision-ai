"use client";
import { useState, useEffect } from 'react';
import { UserPlus, Trash2, Upload, CheckCircle2 } from 'lucide-react';
import { toast } from 'sonner';
import { createClient } from '@/lib/supabase/client';

const MODELS_BUCKET = 'model-uploads';

interface UserRow {
  id: string;
  role: string;
  email: string;
  last_sign_in_at: string | null;
  full_name: string | null;
}

export function AdminManagement() {
  const [users, setUsers] = useState<UserRow[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(true);
  const [uploadedModel, setUploadedModel] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadedPath, setUploadedPath] = useState<string | null>(null);

  useEffect(() => {
    const supabase = createClient();
    supabase
      .rpc('get_user_list')
      .then(({ data, error }) => {
        if (!error && data) setUsers(data as UserRow[]);
        setLoadingUsers(false);
      });
  }, []);

  const handleModelFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.name.endsWith('.onnx')) {
      toast.error('Only .onnx model files are accepted');
      return;
    }
    if (file.size > 500 * 1024 * 1024) {
      toast.error('File size exceeds 500MB limit');
      return;
    }
    setUploadedModel(file);
    setUploadedPath(null);
  };

  const handleModelDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const file = e.dataTransfer.files?.[0];
    if (!file) return;
    if (!file.name.endsWith('.onnx')) {
      toast.error('Only .onnx model files are accepted');
      return;
    }
    if (file.size > 500 * 1024 * 1024) {
      toast.error('File size exceeds 500MB limit');
      return;
    }
    setUploadedModel(file);
    setUploadedPath(null);
  };

  const handleModelUpload = async () => {
    if (!uploadedModel) return;
    setIsUploading(true);
    const toastId = toast.loading('Uploading model...');

    const supabase = createClient();
    const path = `${Date.now()}_${uploadedModel.name}`;
    const { error } = await supabase.storage
      .from(MODELS_BUCKET)
      .upload(path, uploadedModel);

    toast.dismiss(toastId);
    if (error) {
      toast.error('Upload failed');
    } else {
      setUploadedPath(path);
      toast.success('Model uploaded — pending activation');
    }
    setIsUploading(false);
  };

  const handleAddUser = () => {
    toast.info('User creation via Supabase invite — not yet wired');
  };

  const handleDeleteUser = (email: string) => {
    toast.error(`Delete ${email}? This action cannot be undone.`, {
      action: {
        label: 'Confirm',
        onClick: () => toast.success(`User ${email} marked for deletion`),
      },
    });
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="mb-8">
        <h1 className="text-gray-900 dark:text-white mb-2">System Model Management</h1>
        <p className="text-gray-600 dark:text-gray-400">Manage system users and AI model configuration</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Account Management */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700">
          <div className="p-6 border-b border-gray-200 dark:border-gray-700">
            <h2 className="text-gray-900 dark:text-white">Account Management</h2>
          </div>
          <div className="p-6">
            <div className="mb-4">
              <button
                onClick={handleAddUser}
                className="flex items-center space-x-2 px-4 py-2 bg-teal-600 hover:bg-teal-700 dark:bg-teal-500 dark:hover:bg-teal-600 text-white rounded-lg transition-colors"
              >
                <UserPlus className="h-4 w-4" />
                <span className="text-sm">Add New User</span>
              </button>
            </div>

            {loadingUsers ? (
              <p className="text-sm text-gray-500 dark:text-gray-400 py-4">Loading users...</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-gray-200 dark:border-gray-700">
                      <th className="text-left py-3 px-2 text-xs text-gray-700 dark:text-gray-300">Name</th>
                      <th className="text-left py-3 px-2 text-xs text-gray-700 dark:text-gray-300">Email</th>
                      <th className="text-left py-3 px-2 text-xs text-gray-700 dark:text-gray-300">Role</th>
                      <th className="text-left py-3 px-2 text-xs text-gray-700 dark:text-gray-300">Last Login</th>
                      <th className="text-left py-3 px-2 text-xs text-gray-700 dark:text-gray-300">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {users.map((u) => (
                      <tr key={u.id} className="border-b border-gray-100 dark:border-gray-700">
                        <td className="py-3 px-2 text-sm text-gray-900 dark:text-gray-100">
                          {u.full_name ?? '—'}
                        </td>
                        <td className="py-3 px-2 text-sm text-gray-600 dark:text-gray-400">{u.email}</td>
                        <td className="py-3 px-2">
                          <span className={`inline-block px-2 py-1 text-xs rounded ${
                            u.role === 'admin'
                              ? 'bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300'
                              : 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300'
                          }`}>
                            {u.role === 'admin' ? 'Admin' : 'Doctor'}
                          </span>
                        </td>
                        <td className="py-3 px-2 text-sm text-gray-600 dark:text-gray-400">
                          {u.last_sign_in_at
                            ? new Date(u.last_sign_in_at).toLocaleDateString()
                            : 'Never'}
                        </td>
                        <td className="py-3 px-2">
                          <button
                            onClick={() => handleDeleteUser(u.email)}
                            className="p-1 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded transition-colors"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {!loadingUsers && (
              <div className="mt-4 p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                <p className="text-xs text-gray-600 dark:text-gray-400">
                  <strong>Total Users:</strong> {users.length} •{' '}
                  <strong>Admins:</strong> {users.filter((u) => u.role === 'admin').length}
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Model Upload */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700">
          <div className="p-6 border-b border-gray-200 dark:border-gray-700">
            <h2 className="text-gray-900 dark:text-white">Model Update</h2>
          </div>
          <div className="p-6 space-y-6">
            <div>
              <label className="block text-sm text-gray-700 dark:text-gray-300 mb-3">
                Upload New Model File
              </label>
              <div
                onDragOver={(e) => e.preventDefault()}
                onDrop={handleModelDrop}
                className="border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg p-6 text-center bg-gray-50 dark:bg-gray-700/50 hover:border-teal-400 transition-colors"
              >
                <Upload className="h-12 w-12 mx-auto mb-3 text-gray-400 dark:text-gray-500" />
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
                  Drag and drop or browse
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-500 mb-3">
                  Supported format: .onnx (Max size: 500MB)
                </p>
                <input
                  type="file"
                  accept=".onnx"
                  className="hidden"
                  id="model-upload"
                  onChange={handleModelFileChange}
                />
                <label
                  htmlFor="model-upload"
                  className="inline-block px-4 py-2 bg-gray-200 dark:bg-gray-600 text-gray-700 dark:text-gray-200 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-500 cursor-pointer transition-colors text-sm"
                >
                  Browse Files
                </label>
              </div>

              {uploadedModel && (
                <div className={`mt-3 p-3 rounded-lg border ${
                  uploadedPath
                    ? 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800'
                    : 'bg-teal-50 dark:bg-teal-900/20 border-teal-200 dark:border-teal-800'
                }`}>
                  <div className="flex items-center space-x-2">
                    <CheckCircle2 className={`h-4 w-4 ${uploadedPath ? 'text-green-600 dark:text-green-400' : 'text-teal-600 dark:text-teal-400'}`} />
                    <span className="text-sm text-gray-700 dark:text-gray-300">{uploadedModel.name}</span>
                    {uploadedPath && (
                      <span className="ml-auto text-xs px-2 py-0.5 bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-300 rounded">
                        Pending Activation
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 ml-6">
                    {(uploadedModel.size / (1024 * 1024)).toFixed(1)} MB
                  </p>
                </div>
              )}
            </div>

            <button
              onClick={handleModelUpload}
              disabled={!uploadedModel || isUploading || !!uploadedPath}
              className="w-full flex items-center justify-center space-x-2 px-6 py-3 bg-teal-600 hover:bg-teal-700 dark:bg-teal-500 dark:hover:bg-teal-600 text-white rounded-lg transition-colors shadow-md disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Upload className="h-5 w-5" />
              <span>{isUploading ? 'Uploading...' : uploadedPath ? 'Uploaded' : 'Upload Model'}</span>
            </button>

            <div className="p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
              <p className="text-xs text-blue-800 dark:text-blue-300">
                <strong>Note:</strong> Uploaded models are stored and marked as pending. Activation requires a server-side deployment step.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Current Model Info */}
      <div className="mt-8 bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6 border border-gray-200 dark:border-gray-700">
        <h3 className="text-gray-900 dark:text-white mb-4">Current Model Information</h3>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          {[
            { label: 'Model Version', value: 'v1.0.0-EfficientNetB4' },
            { label: 'Architecture', value: 'EfficientNetB4 (ONNX)' },
            { label: 'Training Dataset', value: 'ISIC 2019 (25,331 images)' },
            { label: 'Classes', value: '8 skin lesion types' },
          ].map(({ label, value }) => (
            <div key={label}>
              <p className="text-xs text-gray-600 dark:text-gray-400 mb-1">{label}</p>
              <p className="text-gray-900 dark:text-white">{value}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

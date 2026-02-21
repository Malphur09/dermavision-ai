import { useState } from 'react';
import { Upload, Save, Play, AlertCircle, CheckCircle2 } from 'lucide-react';
import { toast } from 'sonner';

interface DiagnosticInputProps {
  onNavigateToResults: () => void;
}

export function DiagnosticInput({ onNavigateToResults }: DiagnosticInputProps) {
  const [patientId, setPatientId] = useState('');
  const [age, setAge] = useState('');
  const [sex, setSex] = useState('');
  const [lesionSite, setLesionSite] = useState('');
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const [errors, setErrors] = useState<{ [key: string]: string }>({});
  const [isProcessing, setIsProcessing] = useState(false);

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      validateAndSetFile(e.dataTransfer.files[0]);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      validateAndSetFile(e.target.files[0]);
    }
  };

  const validateAndSetFile = (file: File) => {
    // Check file type
    const validTypes = ['image/jpeg', 'image/jpg', 'image/png'];
    if (!validTypes.includes(file.type)) {
      toast.error('Invalid file type. Please upload JPEG or PNG images only.');
      return;
    }

    // Check file size (max 10MB)
    const maxSize = 10 * 1024 * 1024; // 10MB in bytes
    if (file.size > maxSize) {
      toast.error('File size exceeds 10MB limit. Please upload a smaller image.');
      return;
    }

    // Check minimum size (at least 10KB)
    if (file.size < 10 * 1024) {
      toast.error('File is too small. Please upload a valid medical image.');
      return;
    }

    setUploadedFile(file);
    toast.success('Image uploaded successfully!');
  };

  const validatePatientData = () => {
    const newErrors: { [key: string]: string } = {};

    if (!patientId.trim()) {
      newErrors.patientId = 'Patient ID is required';
    } else if (!/^[A-Z]{2}-\d{4}-\d{3}$/i.test(patientId.trim())) {
      newErrors.patientId = 'Invalid format. Use PT-2024-001';
    }

    if (!age.trim()) {
      newErrors.age = 'Age is required';
    } else if (parseInt(age) < 0 || parseInt(age) > 120) {
      newErrors.age = 'Age must be between 0-120';
    }

    if (!sex) {
      newErrors.sex = 'Sex is required';
    }

    if (!lesionSite) {
      newErrors.lesionSite = 'Lesion site is required';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSavePatient = () => {
    if (validatePatientData()) {
      toast.success('Patient record saved successfully!');
      setErrors({});
    } else {
      toast.error('Please fill in all required fields correctly');
    }
  };

  const handleProcess = () => {
    if (!uploadedFile) {
      toast.error('Please upload a dermoscopic image first');
      return;
    }

    if (!validatePatientData()) {
      toast.error('Please complete patient information before processing');
      return;
    }

    setIsProcessing(true);
    toast.loading('Processing image with AI model...');

    // Simulate processing
    setTimeout(() => {
      toast.dismiss();
      toast.success('Classification complete! Viewing results...');
      setIsProcessing(false);
      onNavigateToResults();
    }, 2000);
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="mb-8">
        <h1 className="text-gray-900 dark:text-white mb-2">
          New Patient Diagnosis
        </h1>
        <p className="text-gray-600 dark:text-gray-400">
          Enter patient information and upload dermoscopic image for AI-powered classification
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Left Column: Patient Data */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6 border border-gray-200 dark:border-gray-700">
          <h2 className="text-gray-900 dark:text-white mb-6">
            Patient Data
          </h2>
          
          <div className="space-y-5">
            <div>
              <label htmlFor="patientId" className="block text-sm text-gray-700 dark:text-gray-300 mb-2">
                Patient ID <span className="text-red-500">*</span>
              </label>
              <input
                id="patientId"
                type="text"
                value={patientId}
                onChange={(e) => {
                  setPatientId(e.target.value);
                  if (errors.patientId) setErrors({ ...errors, patientId: undefined });
                }}
                placeholder="e.g., PT-2024-001"
                className={`w-full px-4 py-3 border rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 ${
                  errors.patientId 
                    ? 'border-red-500 focus:ring-red-500' 
                    : 'border-gray-300 dark:border-gray-600 focus:ring-teal-500 dark:focus:ring-teal-400'
                }`}
              />
              {errors.patientId && (
                <div className="mt-1 flex items-center text-sm text-red-600 dark:text-red-400">
                  <AlertCircle className="h-4 w-4 mr-1" />
                  {errors.patientId}
                </div>
              )}
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label htmlFor="age" className="block text-sm text-gray-700 dark:text-gray-300 mb-2">
                  Age <span className="text-red-500">*</span>
                </label>
                <input
                  id="age"
                  type="number"
                  value={age}
                  onChange={(e) => {
                    setAge(e.target.value);
                    if (errors.age) setErrors({ ...errors, age: undefined });
                  }}
                  placeholder="e.g., 45"
                  className={`w-full px-4 py-3 border rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 ${
                    errors.age 
                      ? 'border-red-500 focus:ring-red-500' 
                      : 'border-gray-300 dark:border-gray-600 focus:ring-teal-500 dark:focus:ring-teal-400'
                  }`}
                />
                {errors.age && (
                  <div className="mt-1 flex items-center text-sm text-red-600 dark:text-red-400">
                    <AlertCircle className="h-4 w-4 mr-1" />
                    {errors.age}
                  </div>
                )}
              </div>

              <div>
                <label htmlFor="sex" className="block text-sm text-gray-700 dark:text-gray-300 mb-2">
                  Sex <span className="text-red-500">*</span>
                </label>
                <select
                  id="sex"
                  value={sex}
                  onChange={(e) => {
                    setSex(e.target.value);
                    if (errors.sex) setErrors({ ...errors, sex: undefined });
                  }}
                  className={`w-full px-4 py-3 border rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 ${
                    errors.sex 
                      ? 'border-red-500 focus:ring-red-500' 
                      : 'border-gray-300 dark:border-gray-600 focus:ring-teal-500 dark:focus:ring-teal-400'
                  }`}
                >
                  <option value="">Select</option>
                  <option value="male">Male</option>
                  <option value="female">Female</option>
                  <option value="other">Other</option>
                </select>
                {errors.sex && (
                  <div className="mt-1 flex items-center text-sm text-red-600 dark:text-red-400">
                    <AlertCircle className="h-4 w-4 mr-1" />
                    {errors.sex}
                  </div>
                )}
              </div>
            </div>

            <div>
              <label htmlFor="lesionSite" className="block text-sm text-gray-700 dark:text-gray-300 mb-2">
                Lesion Site <span className="text-red-500">*</span>
              </label>
              <select
                id="lesionSite"
                value={lesionSite}
                onChange={(e) => {
                  setLesionSite(e.target.value);
                  if (errors.lesionSite) setErrors({ ...errors, lesionSite: undefined });
                }}
                className={`w-full px-4 py-3 border rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 ${
                  errors.lesionSite 
                    ? 'border-red-500 focus:ring-red-500' 
                    : 'border-gray-300 dark:border-gray-600 focus:ring-teal-500 dark:focus:ring-teal-400'
                }`}
              >
                <option value="">Select location</option>
                <option value="back">Back</option>
                <option value="arm">Arm</option>
                <option value="leg">Leg</option>
                <option value="face">Face</option>
                <option value="chest">Chest</option>
                <option value="abdomen">Abdomen</option>
                <option value="hand">Hand</option>
                <option value="foot">Foot</option>
              </select>
              {errors.lesionSite && (
                <div className="mt-1 flex items-center text-sm text-red-600 dark:text-red-400">
                  <AlertCircle className="h-4 w-4 mr-1" />
                  {errors.lesionSite}
                </div>
              )}
            </div>

            <button 
              onClick={handleSavePatient}
              className="w-full flex items-center justify-center space-x-2 px-6 py-3 bg-blue-600 hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600 text-white rounded-lg transition-colors shadow-md"
            >
              <Save className="h-5 w-5" />
              <span>Save Patient Record</span>
            </button>
          </div>
        </div>

        {/* Right Column: Image Upload */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6 border border-gray-200 dark:border-gray-700">
          <h2 className="text-gray-900 dark:text-white mb-6">
            Image Upload
          </h2>

          <div
            onDragEnter={handleDrag}
            onDragLeave={handleDrag}
            onDragOver={handleDrag}
            onDrop={handleDrop}
            className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
              dragActive
                ? 'border-teal-500 bg-teal-50 dark:bg-teal-900/20'
                : 'border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-700/50'
            }`}
          >
            <Upload className="h-16 w-16 mx-auto mb-4 text-gray-400 dark:text-gray-500" />
            <h3 className="text-gray-900 dark:text-white mb-2">
              Upload Dermoscopic Image
            </h3>
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
              Drag and drop your file here, or click to browse
            </p>
            <p className="text-xs text-gray-500 dark:text-gray-500 mb-4">
              Supported formats: JPEG, PNG (Max size: 10MB)
            </p>
            <input
              type="file"
              onChange={handleFileChange}
              accept="image/jpeg,image/png"
              className="hidden"
              id="file-upload"
            />
            <label
              htmlFor="file-upload"
              className="inline-block px-6 py-2 bg-gray-200 dark:bg-gray-600 text-gray-700 dark:text-gray-200 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-500 cursor-pointer transition-colors"
            >
              Browse Files
            </label>
          </div>

          {uploadedFile && (
            <div className="mt-6 p-4 bg-teal-50 dark:bg-teal-900/20 border border-teal-200 dark:border-teal-800 rounded-lg">
              <div className="flex items-start">
                <CheckCircle2 className="h-5 w-5 text-teal-600 dark:text-teal-400 mr-2 mt-0.5" />
                <div className="flex-1">
                  <p className="text-sm text-gray-700 dark:text-gray-300">
                    <span className="text-teal-700 dark:text-teal-400">File selected:</span> {uploadedFile.name}
                  </p>
                  <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">
                    Size: {(uploadedFile.size / 1024).toFixed(2)} KB
                  </p>
                </div>
              </div>
            </div>
          )}

          <button
            onClick={handleProcess}
            disabled={!uploadedFile || isProcessing}
            className="w-full mt-6 flex items-center justify-center space-x-2 px-6 py-4 bg-teal-600 hover:bg-teal-700 dark:bg-teal-500 dark:hover:bg-teal-600 text-white rounded-lg transition-colors shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Play className="h-5 w-5" />
            <span>{isProcessing ? 'Processing...' : 'Process & Classify'}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
import { useState } from 'react';
import { FileText, Download, Eye, CheckCircle2, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';

export function ReportGeneration() {
  const [selectedSections, setSelectedSections] = useState({
    patientInfo: true,
    diagnosisResults: true,
    gradCAM: true,
    recommendations: true,
    technicalDetails: false,
  });
  const [exportFormat, setExportFormat] = useState('pdf');
  const [isGenerating, setIsGenerating] = useState(false);

  const toggleSection = (section: keyof typeof selectedSections) => {
    setSelectedSections((prev) => ({
      ...prev,
      [section]: !prev[section],
    }));
  };

  const handlePreview = () => {
    const selectedCount = Object.values(selectedSections).filter(Boolean).length;
    
    if (selectedCount === 0) {
      toast.error('Please select at least one section to preview');
      return;
    }
    
    toast.success('Opening report preview...');
  };

  const handleExport = () => {
    const selectedCount = Object.values(selectedSections).filter(Boolean).length;
    
    if (selectedCount === 0) {
      toast.error('Please select at least one section to export');
      return;
    }
    
    setIsGenerating(true);
    toast.loading(`Generating ${exportFormat.toUpperCase()} report...`);
    
    // Simulate report generation
    setTimeout(() => {
      toast.dismiss();
      toast.success(`Report successfully exported as ${exportFormat.toUpperCase()}!`);
      setIsGenerating(false);
    }, 2000);
  };

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="mb-8">
        <h1 className="text-gray-900 dark:text-white mb-2">
          Export Diagnostic Report
        </h1>
        <p className="text-gray-600 dark:text-gray-400">
          Configure and generate comprehensive diagnostic reports for clinical documentation
        </p>
      </div>

      <div className="space-y-6">
        {/* Report Content Configuration */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700">
          <div className="p-6 border-b border-gray-200 dark:border-gray-700">
            <div className="flex items-center space-x-3">
              <CheckCircle2 className="h-6 w-6 text-teal-600 dark:text-teal-400" />
              <h2 className="text-gray-900 dark:text-white">
                Report Content
              </h2>
            </div>
          </div>

          <div className="p-6 space-y-4">
            <div className="flex items-start space-x-3 p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors">
              <input
                id="patientInfo"
                type="checkbox"
                checked={selectedSections.patientInfo}
                onChange={() => toggleSection('patientInfo')}
                className="mt-1 h-5 w-5 text-teal-600 focus:ring-teal-500 border-gray-300 rounded"
              />
              <div className="flex-1">
                <label htmlFor="patientInfo" className="block text-gray-900 dark:text-white cursor-pointer">
                  Include Patient Demographics
                </label>
                <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                  Add patient ID, age, sex, and lesion site information to the report
                </p>
              </div>
            </div>

            <div className="flex items-start space-x-3 p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors">
              <input
                id="diagnosisResults"
                type="checkbox"
                checked={selectedSections.diagnosisResults}
                onChange={() => toggleSection('diagnosisResults')}
                className="mt-1 h-5 w-5 text-teal-600 focus:ring-teal-500 border-gray-300 rounded"
              />
              <div className="flex-1">
                <label htmlFor="diagnosisResults" className="block text-gray-900 dark:text-white cursor-pointer">
                  Include Diagnosis Results
                </label>
                <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                  Display detailed diagnosis findings and confidence scores
                </p>
              </div>
            </div>

            <div className="flex items-start space-x-3 p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors">
              <input
                id="gradCAM"
                type="checkbox"
                checked={selectedSections.gradCAM}
                onChange={() => toggleSection('gradCAM')}
                className="mt-1 h-5 w-5 text-teal-600 focus:ring-teal-500 border-gray-300 rounded"
              />
              <div className="flex-1">
                <label htmlFor="gradCAM" className="block text-gray-900 dark:text-white cursor-pointer">
                  Include Grad-CAM Visualization
                </label>
                <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                  Add heatmap overlay showing model attention regions for interpretability
                </p>
              </div>
            </div>

            <div className="flex items-start space-x-3 p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors">
              <input
                id="recommendations"
                type="checkbox"
                checked={selectedSections.recommendations}
                onChange={() => toggleSection('recommendations')}
                className="mt-1 h-5 w-5 text-teal-600 focus:ring-teal-500 border-gray-300 rounded"
              />
              <div className="flex-1">
                <label htmlFor="recommendations" className="block text-gray-900 dark:text-white cursor-pointer">
                  Include Recommendations
                </label>
                <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                  Provide actionable recommendations based on the diagnosis
                </p>
              </div>
            </div>

            <div className="flex items-start space-x-3 p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors">
              <input
                id="technicalDetails"
                type="checkbox"
                checked={selectedSections.technicalDetails}
                onChange={() => toggleSection('technicalDetails')}
                className="mt-1 h-5 w-5 text-teal-600 focus:ring-teal-500 border-gray-300 rounded"
              />
              <div className="flex-1">
                <label htmlFor="technicalDetails" className="block text-gray-900 dark:text-white cursor-pointer">
                  Include Technical Details
                </label>
                <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                  Add technical details: model version, inference time, and validation metrics
                </p>
              </div>
            </div>

            <div className="flex items-start space-x-3 p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors">
              <input
                id="disclaimer"
                type="checkbox"
                defaultChecked
                disabled
                className="mt-1 h-5 w-5 text-gray-400 border-gray-300 rounded"
              />
              <div className="flex-1">
                <label htmlFor="disclaimer" className="block text-gray-500 dark:text-gray-400">
                  Include Clinical Disclaimer (Required)
                </label>
                <p className="text-sm text-gray-500 dark:text-gray-500 mt-1">
                  Legal disclaimer stating AI-assisted diagnosis requires dermatologist review
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Export Format */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700">
          <div className="p-6 border-b border-gray-200 dark:border-gray-700">
            <h2 className="text-gray-900 dark:text-white">
              Export Format
            </h2>
          </div>

          <div className="p-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <button
                onClick={() => setExportFormat('pdf')}
                className={`flex items-start space-x-4 p-4 border-2 rounded-lg transition-all ${
                  exportFormat === 'pdf'
                    ? 'border-teal-500 bg-teal-50 dark:bg-teal-900/30'
                    : 'border-gray-300 dark:border-gray-600 hover:border-gray-400 dark:hover:border-gray-500'
                }`}
              >
                <FileText className={`h-8 w-8 ${
                  exportFormat === 'pdf' ? 'text-teal-600 dark:text-teal-400' : 'text-gray-400'
                }`} />
                <div className="flex-1 text-left">
                  <h3 className={`mb-1 ${
                    exportFormat === 'pdf' ? 'text-teal-700 dark:text-teal-300' : 'text-gray-900 dark:text-white'
                  }`}>
                    PDF Document
                  </h3>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    Professional formatted report suitable for clinical records and patient handouts
                  </p>
                </div>
              </button>

              <button
                onClick={() => setExportFormat('json')}
                className={`flex items-start space-x-4 p-4 border-2 rounded-lg transition-all ${
                  exportFormat === 'json'
                    ? 'border-teal-500 bg-teal-50 dark:bg-teal-900/30'
                    : 'border-gray-300 dark:border-gray-600 hover:border-gray-400 dark:hover:border-gray-500'
                }`}
              >
                <FileText className={`h-8 w-8 ${
                  exportFormat === 'json' ? 'text-teal-600 dark:text-teal-400' : 'text-gray-400'
                }`} />
                <div className="flex-1 text-left">
                  <h3 className={`mb-1 ${
                    exportFormat === 'json' ? 'text-teal-700 dark:text-teal-300' : 'text-gray-900 dark:text-white'
                  }`}>
                    JSON Data
                  </h3>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    Machine-readable format for integration with EMR systems and data analysis
                  </p>
                </div>
              </button>
            </div>
          </div>
        </div>

        {/* Report Preview Summary */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700">
          <div className="p-6 border-b border-gray-200 dark:border-gray-700">
            <h2 className="text-gray-900 dark:text-white">
              Report Summary
            </h2>
          </div>

          <div className="p-6">
            <div className="space-y-3 mb-6">
              <div className="flex items-center justify-between py-2 border-b border-gray-100 dark:border-gray-700">
                <span className="text-sm text-gray-600 dark:text-gray-400">Patient ID</span>
                <span className="text-gray-900 dark:text-white">PT-2024-001</span>
              </div>
              <div className="flex items-center justify-between py-2 border-b border-gray-100 dark:border-gray-700">
                <span className="text-sm text-gray-600 dark:text-gray-400">Diagnosis Date</span>
                <span className="text-gray-900 dark:text-white">2025-12-10</span>
              </div>
              <div className="flex items-center justify-between py-2 border-b border-gray-100 dark:border-gray-700">
                <span className="text-sm text-gray-600 dark:text-gray-400">Primary Classification</span>
                <span className="text-gray-900 dark:text-white">Melanoma (92.5%)</span>
              </div>
              <div className="flex items-center justify-between py-2 border-b border-gray-100 dark:border-gray-700">
                <span className="text-sm text-gray-600 dark:text-gray-400">Report Components</span>
                <span className="text-gray-900 dark:text-white">
                  {[selectedSections.patientInfo, selectedSections.diagnosisResults, selectedSections.gradCAM, selectedSections.recommendations, selectedSections.technicalDetails].filter(Boolean).length + 1} sections
                </span>
              </div>
              <div className="flex items-center justify-between py-2">
                <span className="text-sm text-gray-600 dark:text-gray-400">Export Format</span>
                <span className="text-gray-900 dark:text-white uppercase">{exportFormat}</span>
              </div>
            </div>

            <div className="p-4 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg mb-6">
              <p className="text-sm text-yellow-800 dark:text-yellow-300">
                <strong>Important:</strong> This report is intended for licensed healthcare professionals. AI predictions must be confirmed through clinical evaluation and histopathology when indicated.
              </p>
            </div>

            <div className="flex space-x-4">
              <button
                onClick={handlePreview}
                className="w-full flex items-center justify-center space-x-2 px-6 py-4 bg-teal-600 hover:bg-teal-700 dark:bg-teal-500 dark:hover:bg-teal-600 text-white rounded-lg transition-colors shadow-lg"
              >
                <Eye className="h-5 w-5" />
                <span>Preview Report</span>
              </button>

              <button
                onClick={handleExport}
                className="w-full flex items-center justify-center space-x-2 px-6 py-4 bg-teal-600 hover:bg-teal-700 dark:bg-teal-500 dark:hover:bg-teal-600 text-white rounded-lg transition-colors shadow-lg"
              >
                <Download className="h-5 w-5" />
                <span>Generate and Download Report</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
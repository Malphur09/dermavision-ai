"use client";
import { useState, useEffect } from 'react';
import { FileText, Download, Eye, CheckCircle2, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';

interface CaseSession {
  caseId: string;
  patientId: string;
  predictedClass: string;
  confidence: number | null;
}

export function ReportGeneration() {
  const { user } = useAuth();
  const router = useRouter();
  const [caseData, setCaseData] = useState<CaseSession | null>(null);
  const [selectedSections, setSelectedSections] = useState({
    patientInfo: true,
    diagnosisResults: true,
    gradCAM: true,
    recommendations: true,
    technicalDetails: false,
  });
  const [exportFormat, setExportFormat] = useState<'pdf' | 'json'>('pdf');
  const [isGenerating, setIsGenerating] = useState(false);

  useEffect(() => {
    const raw = sessionStorage.getItem('lastCase');
    if (raw) {
      try { setCaseData(JSON.parse(raw)); } catch { /* ignore */ }
    }
  }, []);

  const toggleSection = (section: keyof typeof selectedSections) => {
    setSelectedSections((prev) => ({ ...prev, [section]: !prev[section] }));
  };

  const handlePreview = () => {
    if (!Object.values(selectedSections).some(Boolean)) {
      toast.error('Please select at least one section to preview');
      return;
    }
    toast.success('Opening report preview...');
  };

  const handleExport = async () => {
    if (!Object.values(selectedSections).some(Boolean)) {
      toast.error('Please select at least one section to export');
      return;
    }
    if (!caseData || !user) {
      toast.error('No case data found. Run a diagnosis first.');
      return;
    }

    setIsGenerating(true);
    const toastId = toast.loading(`Generating ${exportFormat.toUpperCase()} report...`);

    const supabase = createClient();
    const { error } = await supabase.from('reports').insert({
      case_id: caseData.caseId,
      doctor_id: user.id,
      sections: selectedSections,
      format: exportFormat,
    });

    toast.dismiss(toastId);
    if (error) {
      toast.error('Failed to save report');
    } else {
      toast.success(`Report saved as ${exportFormat.toUpperCase()}!`);
    }
    setIsGenerating(false);
  };

  const diagnosisLabel = caseData
    ? `${caseData.predictedClass}${caseData.confidence != null ? ` (${caseData.confidence.toFixed(1)}%)` : ''}`
    : '—';

  const sectionCount = Object.values(selectedSections).filter(Boolean).length + 1; // +1 for required disclaimer

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

      {!caseData && (
        <div className="mb-6 p-4 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg flex items-center space-x-3">
          <AlertCircle className="h-5 w-5 text-yellow-600 dark:text-yellow-400 flex-shrink-0" />
          <p className="text-sm text-yellow-800 dark:text-yellow-300">
            No case loaded.{' '}
            <button onClick={() => router.push('/diagnostic')} className="underline font-medium">
              Run a diagnosis first.
            </button>
          </p>
        </div>
      )}

      <div className="space-y-6">
        {/* Report Content Configuration */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700">
          <div className="p-6 border-b border-gray-200 dark:border-gray-700">
            <div className="flex items-center space-x-3">
              <CheckCircle2 className="h-6 w-6 text-teal-600 dark:text-teal-400" />
              <h2 className="text-gray-900 dark:text-white">Report Content</h2>
            </div>
          </div>

          <div className="p-6 space-y-4">
            {(
              [
                { key: 'patientInfo', label: 'Include Patient Demographics', desc: 'Add patient ID, age, sex, and lesion site information to the report' },
                { key: 'diagnosisResults', label: 'Include Diagnosis Results', desc: 'Display detailed diagnosis findings and confidence scores' },
                { key: 'gradCAM', label: 'Include Grad-CAM Visualization', desc: 'Add heatmap overlay showing model attention regions for interpretability' },
                { key: 'recommendations', label: 'Include Recommendations', desc: 'Provide actionable recommendations based on the diagnosis' },
                { key: 'technicalDetails', label: 'Include Technical Details', desc: 'Add technical details: model version, inference time, and validation metrics' },
              ] as const
            ).map(({ key, label, desc }) => (
              <div key={key} className="flex items-start space-x-3 p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors">
                <input
                  id={key}
                  type="checkbox"
                  checked={selectedSections[key]}
                  onChange={() => toggleSection(key)}
                  className="mt-1 h-5 w-5 text-teal-600 focus:ring-teal-500 border-gray-300 rounded"
                />
                <div className="flex-1">
                  <label htmlFor={key} className="block text-gray-900 dark:text-white cursor-pointer">{label}</label>
                  <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">{desc}</p>
                </div>
              </div>
            ))}

            <div className="flex items-start space-x-3 p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
              <input type="checkbox" defaultChecked disabled className="mt-1 h-5 w-5 text-gray-400 border-gray-300 rounded" />
              <div className="flex-1">
                <label className="block text-gray-500 dark:text-gray-400">Include Clinical Disclaimer (Required)</label>
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
            <h2 className="text-gray-900 dark:text-white">Export Format</h2>
          </div>
          <div className="p-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {(['pdf', 'json'] as const).map((fmt) => (
                <button
                  key={fmt}
                  onClick={() => setExportFormat(fmt)}
                  className={`flex items-start space-x-4 p-4 border-2 rounded-lg transition-all ${
                    exportFormat === fmt
                      ? 'border-teal-500 bg-teal-50 dark:bg-teal-900/30'
                      : 'border-gray-300 dark:border-gray-600 hover:border-gray-400 dark:hover:border-gray-500'
                  }`}
                >
                  <FileText className={`h-8 w-8 ${exportFormat === fmt ? 'text-teal-600 dark:text-teal-400' : 'text-gray-400'}`} />
                  <div className="flex-1 text-left">
                    <h3 className={`mb-1 ${exportFormat === fmt ? 'text-teal-700 dark:text-teal-300' : 'text-gray-900 dark:text-white'}`}>
                      {fmt === 'pdf' ? 'PDF Document' : 'JSON Data'}
                    </h3>
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      {fmt === 'pdf'
                        ? 'Professional formatted report suitable for clinical records and patient handouts'
                        : 'Machine-readable format for integration with EMR systems and data analysis'}
                    </p>
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Report Summary */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700">
          <div className="p-6 border-b border-gray-200 dark:border-gray-700">
            <h2 className="text-gray-900 dark:text-white">Report Summary</h2>
          </div>
          <div className="p-6">
            <div className="space-y-3 mb-6">
              {[
                { label: 'Patient ID', value: caseData?.patientId ?? '—' },
                { label: 'Diagnosis Date', value: new Date().toLocaleDateString() },
                { label: 'Primary Classification', value: diagnosisLabel },
                { label: 'Report Components', value: `${sectionCount} sections` },
                { label: 'Export Format', value: exportFormat.toUpperCase() },
              ].map(({ label, value }) => (
                <div key={label} className="flex items-center justify-between py-2 border-b border-gray-100 dark:border-gray-700 last:border-0">
                  <span className="text-sm text-gray-600 dark:text-gray-400">{label}</span>
                  <span className="text-gray-900 dark:text-white">{value}</span>
                </div>
              ))}
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
                disabled={isGenerating || !caseData}
                className="w-full flex items-center justify-center space-x-2 px-6 py-4 bg-teal-600 hover:bg-teal-700 dark:bg-teal-500 dark:hover:bg-teal-600 text-white rounded-lg transition-colors shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Download className="h-5 w-5" />
                <span>{isGenerating ? 'Saving...' : 'Generate and Download Report'}</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

"use client";
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Save, FileDown, Clock, AlertCircle } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';

const IMAGES_BUCKET = 'dermoscopy-images';

const F1_SCORES: Record<string, number> = {
  'Melanoma': 0.89,
  'Melanocytic Nevus': 0.91,
  'Basal Cell Carcinoma': 0.87,
  'Actinic Keratosis': 0.85,
  'Benign Keratosis': 0.88,
  'Dermatofibroma': 0.82,
  'Vascular Lesion': 0.84,
  'Squamous Cell Carcinoma': 0.83,
};

const CLINICAL_NOTES: Record<string, string> = {
  'Melanoma': 'High confidence melanoma detection. Recommend immediate dermatological consultation and biopsy for histopathological confirmation.',
  'Squamous Cell Carcinoma': 'High confidence squamous cell carcinoma detection. Urgent dermatological evaluation recommended.',
  'Basal Cell Carcinoma': 'Basal cell carcinoma suspected. Dermatological consultation recommended for treatment planning.',
  'Actinic Keratosis': 'Actinic keratosis detected. Monitor closely; consider cryotherapy or topical treatment.',
  'Melanocytic Nevus': 'Benign melanocytic nevus. Routine monitoring recommended.',
  'Benign Keratosis': 'Benign keratosis-like lesion. No urgent action required.',
  'Dermatofibroma': 'Dermatofibroma suspected. Benign; no treatment required unless symptomatic.',
  'Vascular Lesion': 'Vascular lesion detected. Clinical correlation recommended.',
};

interface CaseSession {
  caseId: string;
  patientId: string;
  patientName: string;
  predictedClass: string;
  probabilities: Record<string, number>;
  confidence: number | null;
  riskLevel: string;
  lesionSite: string;
  storagePath: string;
  heatmapDataUrl: string | null;
}

export function DiagnosisResults() {
  const router = useRouter();
  const [caseData, setCaseData] = useState<CaseSession | null>(null);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [loadingImage, setLoadingImage] = useState(true);
  const [heatmapDataUrl, setHeatmapDataUrl] = useState<string | null>(null);
  const [heatmapPending, setHeatmapPending] = useState(true);

  useEffect(() => {
    const raw = sessionStorage.getItem('lastCase');
    if (!raw) { setLoadingImage(false); setHeatmapPending(false); return; }

    let parsed: CaseSession;
    try { parsed = JSON.parse(raw); } catch { setLoadingImage(false); setHeatmapPending(false); return; }
    setCaseData(parsed);

    if (parsed.heatmapDataUrl) {
      setHeatmapDataUrl(parsed.heatmapDataUrl);
      setHeatmapPending(false);
    }

    const supabase = createClient();
    supabase.storage
      .from(IMAGES_BUCKET)
      .createSignedUrl(parsed.storagePath, 3600)
      .then(({ data }) => { if (data?.signedUrl) setImageUrl(data.signedUrl); })
      .finally(() => setLoadingImage(false));
  }, []);

  useEffect(() => {
    if (!heatmapPending) return;
    const interval = setInterval(() => {
      const raw = sessionStorage.getItem('lastCase');
      if (!raw) { clearInterval(interval); setHeatmapPending(false); return; }
      const parsed = JSON.parse(raw) as CaseSession;
      if (parsed.heatmapDataUrl) {
        setHeatmapDataUrl(parsed.heatmapDataUrl);
        setHeatmapPending(false);
        clearInterval(interval);
      }
    }, 500);
    const timeout = setTimeout(() => { clearInterval(interval); setHeatmapPending(false); }, 30_000);
    return () => { clearInterval(interval); clearTimeout(timeout); };
  }, [heatmapPending]);

  if (!caseData) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex flex-col items-center justify-center py-24 space-y-4">
          <AlertCircle className="h-12 w-12 text-gray-400" />
          <p className="text-gray-600 dark:text-gray-400">No case data found. Run a diagnosis first.</p>
          <button
            onClick={() => router.push('/diagnostic')}
            className="px-6 py-3 bg-teal-600 hover:bg-teal-700 text-white rounded-lg transition-colors"
          >
            Go to Diagnostic
          </button>
        </div>
      </div>
    );
  }

  const ranked = Object.entries(caseData.probabilities)
    .sort(([, a], [, b]) => b - a)
    .map(([cls, prob], idx) => ({
      class: cls,
      probability: Math.round(prob * 10000) / 100,
      f1Score: F1_SCORES[cls] ?? 0.80,
      rank: idx + 1,
    }));

  const clinicalNote = CLINICAL_NOTES[caseData.predictedClass] ?? 'Clinical correlation recommended.';
  const isHighRisk = caseData.riskLevel === 'High Risk';

  const ImageSlot = ({
    label,
    src,
    pending,
    unavailable,
  }: {
    label: string;
    src?: string | null;
    pending?: boolean;
    unavailable?: boolean;
  }) => (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6 border border-gray-200 dark:border-gray-700">
      <h3 className="text-gray-900 dark:text-white mb-4">{label}</h3>
      <div className="aspect-square bg-gray-100 dark:bg-gray-700 rounded-lg overflow-hidden relative flex items-center justify-center">
        {pending ? (
          <span className="text-gray-400 text-sm">Generating...</span>
        ) : src ? (
          <img src={src} alt={label} className="w-full h-full object-cover" />
        ) : (
          <span className="text-gray-400 text-sm">
            {unavailable ? 'Grad-CAM unavailable' : 'Image unavailable'}
          </span>
        )}
        {pending && (
          <div className="absolute bottom-2 right-2 bg-black/70 text-white text-xs px-2 py-1 rounded">
            Generating
          </div>
        )}
      </div>
      {(pending || src) && (
        <div className="mt-4 flex items-center space-x-2 text-xs">
          <div className="w-8 h-3 bg-gradient-to-r from-blue-500 via-yellow-500 to-red-500 rounded" />
          <span className="text-gray-600 dark:text-gray-400">Low → High Activation</span>
        </div>
      )}
    </div>
  );

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="mb-8">
        <h1 className="text-gray-900 dark:text-white mb-2">
          Classification Analysis & Interpretability
        </h1>
        <p className="text-gray-600 dark:text-gray-400">
          Deep learning model output with visual explanation and confidence scores
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
        <div className="lg:col-span-1 space-y-6">
          <ImageSlot label="Original Image" src={loadingImage ? null : imageUrl} pending={loadingImage} />
          <ImageSlot
            label="Grad-CAM Visualization"
            src={heatmapDataUrl}
            pending={heatmapPending}
            unavailable={!heatmapPending && !heatmapDataUrl}
          />
        </div>

        <div className="lg:col-span-2 bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6 border border-gray-200 dark:border-gray-700">
          <h3 className="text-gray-900 dark:text-white mb-6">Classification Results</h3>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-200 dark:border-gray-700">
                  <th className="text-left py-3 px-4 text-sm text-gray-700 dark:text-gray-300">Rank</th>
                  <th className="text-left py-3 px-4 text-sm text-gray-700 dark:text-gray-300">Classification</th>
                  <th className="text-left py-3 px-4 text-sm text-gray-700 dark:text-gray-300">Probability</th>
                  <th className="text-left py-3 px-4 text-sm text-gray-700 dark:text-gray-300">F1-Score</th>
                  <th className="text-left py-3 px-4 text-sm text-gray-700 dark:text-gray-300">Confidence</th>
                </tr>
              </thead>
              <tbody>
                {ranked.map((result) => {
                  const isPredicted = result.rank === 1;
                  return (
                    <tr
                      key={result.class}
                      className={`border-b border-gray-100 dark:border-gray-700 ${
                        isPredicted ? 'bg-red-50 dark:bg-red-900/20' : ''
                      }`}
                    >
                      <td className="py-4 px-4">
                        <span className={`inline-flex items-center justify-center w-8 h-8 rounded-full text-sm ${
                          isPredicted
                            ? 'bg-red-600 text-white'
                            : 'bg-gray-200 dark:bg-gray-600 text-gray-700 dark:text-gray-300'
                        }`}>
                          {result.rank}
                        </span>
                      </td>
                      <td className="py-4 px-4">
                        <span className={isPredicted ? 'text-red-700 dark:text-red-400' : 'text-gray-900 dark:text-gray-100'}>
                          {result.class}
                        </span>
                        {isPredicted && (
                          <span className="ml-2 inline-block px-2 py-1 bg-red-600 text-white text-xs rounded">
                            PREDICTED
                          </span>
                        )}
                      </td>
                      <td className="py-4 px-4 text-gray-900 dark:text-gray-100">
                        {result.probability.toFixed(1)}%
                      </td>
                      <td className="py-4 px-4 text-gray-900 dark:text-gray-100">
                        {result.f1Score.toFixed(2)}
                      </td>
                      <td className="py-4 px-4">
                        <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2.5">
                          <div
                            className={`h-2.5 rounded-full ${isPredicted ? 'bg-red-600' : 'bg-teal-500'}`}
                            style={{ width: `${Math.min(result.probability, 100)}%` }}
                          />
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className={`mt-6 p-4 border rounded-lg ${
            isHighRisk
              ? 'bg-yellow-50 dark:bg-yellow-900/20 border-yellow-200 dark:border-yellow-800'
              : 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800'
          }`}>
            <p className={`text-sm ${
              isHighRisk
                ? 'text-yellow-800 dark:text-yellow-300'
                : 'text-blue-800 dark:text-blue-300'
            }`}>
              <strong>Clinical Note:</strong> {clinicalNote}
            </p>
          </div>
        </div>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6 border border-gray-200 dark:border-gray-700">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between space-y-4 md:space-y-0">
          <div className="flex items-center space-x-6">
            <div className="flex items-center space-x-2">
              <Clock className="h-5 w-5 text-gray-600 dark:text-gray-400" />
              <div>
                <p className="text-xs text-gray-600 dark:text-gray-400">Patient</p>
                <p className="text-gray-900 dark:text-white">{caseData.patientId}</p>
              </div>
            </div>
            <div className="border-l border-gray-300 dark:border-gray-600 pl-6">
              <p className="text-xs text-gray-600 dark:text-gray-400">Risk Level</p>
              <p className={isHighRisk ? 'text-red-600 dark:text-red-400' : 'text-green-600 dark:text-green-400'}>
                {caseData.riskLevel}
              </p>
            </div>
            <div className="border-l border-gray-300 dark:border-gray-600 pl-6">
              <p className="text-xs text-gray-600 dark:text-gray-400">Timestamp</p>
              <p className="text-gray-900 dark:text-white">{new Date().toLocaleString()}</p>
            </div>
          </div>

          <div className="flex space-x-4">
            <button
              onClick={() => router.push('/records')}
              className="flex items-center space-x-2 px-6 py-3 bg-blue-600 hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600 text-white rounded-lg transition-colors shadow-md"
            >
              <Save className="h-5 w-5" />
              <span>View Patient Record</span>
            </button>
            <button
              onClick={() => router.push('/report')}
              className="flex items-center space-x-2 px-6 py-3 bg-teal-600 hover:bg-teal-700 dark:bg-teal-500 dark:hover:bg-teal-600 text-white rounded-lg transition-colors shadow-md"
            >
              <FileDown className="h-5 w-5" />
              <span>Export Report</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

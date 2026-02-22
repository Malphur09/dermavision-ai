import { Save, FileDown, Clock } from 'lucide-react';

const classificationResults = [
  { class: 'Melanoma', probability: 92.5, f1Score: 0.89, rank: 1 },
  { class: 'Nevus', probability: 4.2, f1Score: 0.91, rank: 2 },
  { class: 'Basal Cell Carcinoma (BCC)', probability: 1.8, f1Score: 0.87, rank: 3 },
  { class: 'Actinic Keratosis', probability: 0.7, f1Score: 0.85, rank: 4 },
  { class: 'Benign Keratosis', probability: 0.4, f1Score: 0.88, rank: 5 },
  { class: 'Dermatofibroma', probability: 0.2, f1Score: 0.82, rank: 6 },
  { class: 'Vascular Lesion', probability: 0.1, f1Score: 0.84, rank: 7 },
  { class: 'Squamous Cell Carcinoma', probability: 0.1, f1Score: 0.83, rank: 8 },
];

export function DiagnosisResults() {
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

      {/* Top Section: Visuals and Results */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
        {/* Left Panel: Visual Outputs */}
        <div className="lg:col-span-1 space-y-6">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6 border border-gray-200 dark:border-gray-700">
            <h3 className="text-gray-900 dark:text-white mb-4">
              Original Image
            </h3>
            <div className="aspect-square bg-gray-100 dark:bg-gray-700 rounded-lg overflow-hidden">
              <img
                src="https://images.unsplash.com/photo-1602926280191-948de7f729c5?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxza2luJTIwbGVzaW9uJTIwZGVybWF0b2xvZ3l8ZW58MXx8fHwxNzY1MzIxNjkyfDA&ixlib=rb-4.1.0&q=80&w=1080"
                alt="Original dermoscopic image"
                className="w-full h-full object-cover"
              />
            </div>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6 border border-gray-200 dark:border-gray-700">
            <h3 className="text-gray-900 dark:text-white mb-4">
              Grad-CAM Visualization
            </h3>
            <div className="aspect-square bg-gray-100 dark:bg-gray-700 rounded-lg overflow-hidden relative">
              <img
                src="https://images.unsplash.com/photo-1677678711761-09e049805d97?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxtZWRpY2FsJTIwaGVhdG1hcCUyMHZpc3VhbGl6YXRpb258ZW58MXx8fHwxNzY1Mzc4MDg5fDA&ixlib=rb-4.1.0&q=80&w=1080"
                alt="Grad-CAM heatmap overlay"
                className="w-full h-full object-cover"
              />
              <div className="absolute bottom-2 right-2 bg-black/70 text-white text-xs px-2 py-1 rounded">
                Attention Heatmap
              </div>
            </div>
            <div className="mt-4 flex items-center justify-between text-xs">
              <div className="flex items-center space-x-2">
                <div className="w-8 h-3 bg-gradient-to-r from-blue-500 via-yellow-500 to-red-500 rounded"></div>
                <span className="text-gray-600 dark:text-gray-400">Low → High Activation</span>
              </div>
            </div>
          </div>
        </div>

        {/* Center Panel: Classification Results */}
        <div className="lg:col-span-2 bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6 border border-gray-200 dark:border-gray-700">
          <h3 className="text-gray-900 dark:text-white mb-6">
            Classification Results
          </h3>

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
                {classificationResults.map((result) => {
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
                        <span className={`${isPredicted ? 'text-red-700 dark:text-red-400' : 'text-gray-900 dark:text-gray-100'}`}>
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
                            className={`h-2.5 rounded-full ${
                              isPredicted ? 'bg-red-600' : 'bg-teal-500'
                            }`}
                            style={{ width: `${result.probability}%` }}
                          ></div>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="mt-6 p-4 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg">
            <p className="text-sm text-yellow-800 dark:text-yellow-300">
              <strong>Clinical Note:</strong> High confidence melanoma detection. Recommend immediate dermatological consultation and biopsy for histopathological confirmation.
            </p>
          </div>
        </div>
      </div>

      {/* Bottom Panel: Actions and Metadata */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6 border border-gray-200 dark:border-gray-700">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between space-y-4 md:space-y-0">
          <div className="flex items-center space-x-6">
            <div className="flex items-center space-x-2">
              <Clock className="h-5 w-5 text-gray-600 dark:text-gray-400" />
              <div>
                <p className="text-xs text-gray-600 dark:text-gray-400">Inference Latency</p>
                <p className="text-gray-900 dark:text-white">4.5 seconds</p>
              </div>
            </div>
            <div className="border-l border-gray-300 dark:border-gray-600 pl-6">
              <p className="text-xs text-gray-600 dark:text-gray-400">Model Version</p>
              <p className="text-gray-900 dark:text-white">v2.3.1-ResNet50</p>
            </div>
            <div className="border-l border-gray-300 dark:border-gray-600 pl-6">
              <p className="text-xs text-gray-600 dark:text-gray-400">Timestamp</p>
              <p className="text-gray-900 dark:text-white">2025-12-10 14:32:18</p>
            </div>
          </div>

          <div className="flex space-x-4">
            <button className="flex items-center space-x-2 px-6 py-3 bg-blue-600 hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600 text-white rounded-lg transition-colors shadow-md">
              <Save className="h-5 w-5" />
              <span>Save to Patient Record</span>
            </button>
            <button className="flex items-center space-x-2 px-6 py-3 bg-teal-600 hover:bg-teal-700 dark:bg-teal-500 dark:hover:bg-teal-600 text-white rounded-lg transition-colors shadow-md">
              <FileDown className="h-5 w-5" />
              <span>Export Report (PDF)</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

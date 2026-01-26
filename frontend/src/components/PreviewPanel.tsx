export default function PreviewPanel() {
  return (
    <div className="h-full bg-gray-900 flex items-center justify-center">
      <div className="text-center">
        <div className="w-full max-w-2xl mx-auto p-8 bg-gray-800 rounded-lg border-2 border-dashed border-gray-600">
          <h2 className="text-2xl font-bold text-white mb-4">Aperçu en direct</h2>
          <p className="text-gray-400 mb-6">
            L'aperçu de votre application apparaîtra ici une fois que l'agent commencera à construire.
          </p>
          <div className="bg-gray-700 h-64 rounded-lg flex items-center justify-center">
            <span className="text-gray-500">Preview Iframe</span>
          </div>
        </div>
      </div>
    </div>
  );
}

'use client';

import { useState } from 'react';
import { FileText, Download, Loader2, Presentation, FileOutput } from 'lucide-react';

interface PresentationGeneratorProps {
  missionId: string;
}

type TemplateType = 'executive' | 'detailed' | 'minimal';
type FormatType = 'executive_summary' | 'full_report' | 'phase_by_phase';

export function PresentationGenerator({ missionId }: PresentationGeneratorProps) {
  const [isGenerating, setIsGenerating] = useState(false);
  const [format, setFormat] = useState<FormatType>('executive_summary');
  const [includeRawData, setIncludeRawData] = useState(false);
  const [generatedFile, setGeneratedFile] = useState<{
    downloadUrl: string;
    filename: string;
    fileSize: number;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const generateFromMission = async () => {
    setIsGenerating(true);
    setError(null);
    
    try {
      const response = await fetch('/api/presentations/from-mission', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          missionId,
          format,
          includeRawData
        })
      });

      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || 'Failed to generate presentation');
      }

      const result = await response.json();
      
      if (result.success) {
        setGeneratedFile({
          downloadUrl: result.downloadUrl,
          filename: result.filename,
          fileSize: result.fileSize
        });
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate presentation');
    } finally {
      setIsGenerating(false);
    }
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-4">
      <div className="flex items-center gap-2 mb-4">
        <Presentation className="w-5 h-5 text-[#005EB8]" />
        <h3 className="font-semibold text-gray-900">Generate Presentation</h3>
      </div>

      <div className="space-y-4">
        {/* Format Selection */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Report Format
          </label>
          <div className="grid grid-cols-3 gap-2">
            <button
              onClick={() => setFormat('executive_summary')}
              className={`px-3 py-2 text-sm rounded-lg border transition-colors ${
                format === 'executive_summary'
                  ? 'bg-blue-50 border-[#005EB8] text-[#005EB8]'
                  : 'border-gray-200 text-gray-700 hover:border-gray-300'
              }`}
            >
              Executive Summary
            </button>
            <button
              onClick={() => setFormat('full_report')}
              className={`px-3 py-2 text-sm rounded-lg border transition-colors ${
                format === 'full_report'
                  ? 'bg-blue-50 border-[#005EB8] text-[#005EB8]'
                  : 'border-gray-200 text-gray-700 hover:border-gray-300'
              }`}
            >
              Full Report
            </button>
            <button
              onClick={() => setFormat('phase_by_phase')}
              className={`px-3 py-2 text-sm rounded-lg border transition-colors ${
                format === 'phase_by_phase'
                  ? 'bg-blue-50 border-[#005EB8] text-[#005EB8]'
                  : 'border-gray-200 text-gray-700 hover:border-gray-300'
              }`}
            >
              Phase by Phase
            </button>
          </div>
        </div>

        {/* Options */}
        <div className="flex items-center gap-2">
          <input
            type="checkbox"
            id="include-raw"
            checked={includeRawData}
            onChange={(e) => setIncludeRawData(e.target.checked)}
            className="w-4 h-4 rounded border-gray-300"
          />
          <label htmlFor="include-raw" className="text-sm text-gray-700">
            Include full deliverable content
          </label>
        </div>

        {/* Generate Button */}
        <button
          onClick={generateFromMission}
          disabled={isGenerating}
          className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-[#005EB8] text-white rounded-lg hover:bg-[#004a93] disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isGenerating ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              Generating...
            </>
          ) : (
            <>
              <FileOutput className="w-4 h-4" />
              Generate Word Document
            </>
          )}
        </button>

        {/* Error */}
        {error && (
          <div className="p-3 bg-red-50 text-red-700 rounded-lg text-sm">
            {error}
          </div>
        )}

        {/* Success */}
        {generatedFile && (
          <div className="p-3 bg-green-50 rounded-lg">
            <p className="text-sm text-green-800 font-medium mb-2">
              ✓ Presentation generated successfully!
            </p>
            <a
              href={generatedFile.downloadUrl}
              download={generatedFile.filename}
              className="flex items-center gap-2 px-4 py-2 bg-white border border-green-200 rounded-lg hover:bg-green-50 text-green-700 text-sm"
            >
              <Download className="w-4 h-4" />
              Download {generatedFile.filename} ({formatFileSize(generatedFile.fileSize)})
            </a>
          </div>
        )}

        {/* Format Descriptions */}
        <div className="text-xs text-gray-500 mt-4 pt-4 border-t border-gray-100">
          <p className="font-medium mb-1">Format Options:</p>
          <ul className="space-y-1">
            <li><strong>Executive Summary:</strong> One-page overview with key findings and progress table</li>
            <li><strong>Full Report:</strong> Comprehensive document with all phases, deliverables, and details</li>
            <li><strong>Phase by Phase:</strong> Structured breakdown of each mission phase</li>
          </ul>
        </div>
      </div>
    </div>
  );
}

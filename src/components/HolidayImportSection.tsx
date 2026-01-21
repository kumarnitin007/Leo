import React, { useState } from 'react';
import { EventImportModal } from './EventImportModal';

interface HolidayImportFile {
  name: string;
  url: string;
  description: string;
  icon: string;
  country?: string;
}

interface HolidayImportSectionProps {
  onImportSuccess?: () => void;
}

const HOLIDAY_FILES: HolidayImportFile[] = [
  {
    name: 'Indian National Holidays',
    url: '/sample-indian-holidays-national.json',
    description: 'Republic Day, Independence Day, Diwali, Holi, and other national holidays',
    icon: '🇮🇳',
    country: 'India'
  },
  {
    name: 'Regional & Seasonal Holidays',
    url: '/sample-indian-holidays-regional.json',
    description: 'Regional festivals and seasonal celebrations across India',
    icon: '🎨',
    country: 'India'
  },
  {
    name: 'Business & Important Dates',
    url: '/sample-events-business.json',
    description: 'Financial deadlines, quarterly reviews, and professional milestones',
    icon: '💼',
    country: 'General'
  }
];

export const HolidayImportSection: React.FC<HolidayImportSectionProps> = ({ onImportSuccess }) => {
  const [selectedFile, setSelectedFile] = useState<HolidayImportFile | null>(null);
  const [showModal, setShowModal] = useState(false);

  const handleImportClick = (file: HolidayImportFile) => {
    setSelectedFile(file);
    setShowModal(true);
  };

  const handleCloseModal = () => {
    setShowModal(false);
    setSelectedFile(null);
  };

  const handleImportSuccess = () => {
    onImportSuccess?.();
    handleCloseModal();
  };

  return (
    <div className="space-y-4">
      <div className="bg-gradient-to-r from-orange-50 to-amber-50 dark:from-orange-900/20 dark:to-amber-900/20 border border-orange-200 dark:border-orange-800 rounded-lg p-6">
        <h3 className="text-lg font-semibold text-orange-900 dark:text-orange-300 mb-2">
          📅 Quick Holiday Import
        </h3>
        <p className="text-sm text-orange-800 dark:text-orange-400">
          Import pre-configured holidays and important dates. You can customize tags and choose whether to add to existing events.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {HOLIDAY_FILES.map(file => (
          <div
            key={file.url}
            className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4 hover:shadow-lg hover:border-blue-300 dark:hover:border-blue-600 transition cursor-pointer"
            onClick={() => handleImportClick(file)}
          >
            <div className="text-4xl mb-3">{file.icon}</div>
            <h4 className="font-semibold text-gray-900 dark:text-white mb-1">{file.name}</h4>
            {file.country && (
              <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">{file.country}</p>
            )}
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-4 line-clamp-2">
              {file.description}
            </p>
            <button
              className="w-full px-3 py-2 bg-blue-500 text-white rounded-lg font-medium text-sm hover:bg-blue-600 transition"
              onClick={(e) => {
                e.stopPropagation();
                handleImportClick(file);
              }}
            >
              Import
            </button>
          </div>
        ))}
      </div>

      {selectedFile && (
        <EventImportModal
          isOpen={showModal}
          onClose={handleCloseModal}
          fileUrl={selectedFile.url}
          fileName={selectedFile.name}
          onImportSuccess={handleImportSuccess}
        />
      )}
    </div>
  );
};

/**
 * Smart View
 * 
 * Central hub for AI-powered features:
 * - Voice Commands
 * - Image Scanning (Quick & Smart)
 */

import React, { useState } from 'react';
import VoiceCommandButton from './components/VoiceCommand/VoiceCommandButton';
import VoiceCommandHistory from './components/VoiceCommand/VoiceCommandHistory';
import ImageScanModal from './components/ImageScanModal';
import SmartSuggestionsModal from './components/SmartSuggestionsModal';
import { scanImageWithTesseract } from './services/imageScanning/tesseractService';
import { scanImageWithOpenAI } from './services/imageScanning/openaiVisionService';
import { ScanMode, ScanResult, ExtractedItem } from './services/imageScanning/types';
import { addTask, addEvent } from './storage';
import { createTodoItem } from './services/todoService';
import { getUserSettings, saveUserSettings } from './storage';
import dbService from './services/voice/VoiceCommandDatabaseService';
import { IntentType } from './types/voice-command-db.types';

interface SmartViewProps {
  onNavigate: (view: string) => void;
}

const SmartView: React.FC<SmartViewProps> = ({ onNavigate }) => {
  const [showImageScanModal, setShowImageScanModal] = useState(false);
  const [showSuggestionsModal, setShowSuggestionsModal] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [scanMode, setScanMode] = useState<ScanMode>('quick');
  const [scanResult, setScanResult] = useState<ScanResult | null>(null);
  const [isScanning, setIsScanning] = useState(false);
  const [aiScanEnabled, setAiScanEnabled] = useState(false);
  const [showWarning, setShowWarning] = useState(false);
  const [currentScanId, setCurrentScanId] = useState<string | null>(null);

  React.useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      const settings = await getUserSettings();
      setAiScanEnabled(settings.aiScanEnabled || false);
    } catch (error) {
      console.error('Failed to load settings:', error);
    }
  };

  const handleScanClick = (mode: ScanMode) => {
    if (mode === 'smart' && !aiScanEnabled) {
      setShowWarning(true);
      return;
    }
    setScanMode(mode);
    setShowImageScanModal(true);
  };

  const handleEnableAI = async () => {
    try {
      await saveUserSettings({ aiScanEnabled: true });
      setAiScanEnabled(true);
      setShowWarning(false);
      setScanMode('smart');
      setShowImageScanModal(true);
    } catch (error) {
      console.error('Failed to save settings:', error);
      alert('Failed to enable AI scanning. Please try again.');
    }
  };

  const handleImageSelected = async (file: File, mode: ScanMode) => {
    setIsScanning(true);
    setShowImageScanModal(false);

    try {
      let result: ScanResult;
      
      if (mode === 'quick') {
        result = await scanImageWithTesseract(file);
      } else {
        result = await scanImageWithOpenAI(file);
      }

      // Log scan to database
      try {
        const intentType: IntentType = mode === 'quick' ? 'SCAN_IMAGE_QUICK' : 'SCAN_IMAGE_SMART';
        const scanId = await dbService.saveCommand({
          rawTranscript: result.rawText || `Image scan - ${result.items.length} items found`,
          intentType,
          entityType: 'TASK', // Default, will be updated when item is created
          extractedTitle: result.items.length > 0 ? result.items[0].title : undefined,
          overallConfidence: result.items.length > 0 ? result.items[0].confidence : 0.5,
          outcome: result.success ? 'PENDING' : 'FAILED',
          entities: result.items.map(item => ({
            type: 'TASK',
            value: item.title,
            normalizedValue: item.title,
            confidence: item.confidence,
            meta: item.data
          }))
        });
        setCurrentScanId(scanId);
        console.log('[SmartView] Scan logged with ID:', scanId);
      } catch (dbError) {
        console.warn('[SmartView] Failed to log scan to database:', dbError);
      }

      setScanResult(result);
      setShowSuggestionsModal(true);
    } catch (error) {
      console.error('Scan failed:', error);
      alert('Failed to scan image. Please try again.');
    } finally {
      setIsScanning(false);
    }
  };

  const handleCreateItem = async (item: ExtractedItem) => {
    console.log('[SmartView] Creating item:', item);
    let createdId: string | null = null;
    
    try {
      switch (item.suggestedDestination) {
        case 'event':
          createdId = await createEvent(item);
          alert(`✅ Event "${item.title}" added successfully!`);
          break;
        case 'task':
          createdId = await createTask(item);
          alert(`✅ Task "${item.title}" added successfully!`);
          break;
        case 'todo':
          await createTodo(item);
          alert(`✅ Todo items added successfully!`);
          break;
        case 'journal':
          // Navigate to journal with prefill
          onNavigate('journal');
          break;
        case 'safe':
          // Navigate to safe
          onNavigate('safe');
          break;
        case 'gift-card':
          // Open gift cards modal
          alert('Gift card creation coming soon!');
          break;
        case 'resolution':
          // Navigate to resolutions
          onNavigate('resolutions');
          break;
      }
      
      // Update scan log with success
      if (currentScanId && createdId) {
        try {
          await dbService.updateCommand(currentScanId, {
            outcome: 'SUCCESS',
            createdItemType: item.suggestedDestination,
            createdItemId: createdId
          });
          console.log('[SmartView] Scan log updated with created item');
        } catch (dbError) {
          console.warn('[SmartView] Failed to update scan log:', dbError);
        }
      }
      
      console.log('[SmartView] Item created successfully');
    } catch (error) {
      console.error('[SmartView] Failed to create item:', error);
      
      // Update scan log with failure
      if (currentScanId) {
        try {
          await dbService.updateCommand(currentScanId, {
            outcome: 'FAILED'
          });
        } catch (dbError) {
          console.warn('[SmartView] Failed to update scan log:', dbError);
        }
      }
      
      throw error;
    }
  };

  const createEvent = async (item: ExtractedItem): Promise<string> => {
    const data = item.data;
    console.log('[SmartView] Creating event with data:', { item, data });
    
    const eventId = crypto.randomUUID();
    const eventData = {
      id: eventId,
      name: item.title,
      date: data.date || new Date().toISOString().split('T')[0],
      description: item.description || '',
      category: data.recurring ? 'Birthday' : 'Personal',
      frequency: (data.recurring ? 'yearly' : 'one-time') as 'yearly' | 'one-time',
      year: data.recurring ? undefined : new Date().getFullYear(),
      createdAt: new Date().toISOString()
    };
    
    console.log('[SmartView] Event data to save:', eventData);
    await addEvent(eventData);
    console.log('[SmartView] Event saved successfully');
    return eventId;
  };

  const createTask = async (item: ExtractedItem): Promise<string> => {
    const taskId = crypto.randomUUID();
    await addTask({
      id: taskId,
      name: item.title,
      description: item.description || '',
      category: 'General',
      weightage: 5,
      frequency: 'daily',
      specificDate: item.data.dueDate,
      createdAt: new Date().toISOString()
    });
    return taskId;
  };

  const createTodo = async (item: ExtractedItem) => {
    const items = item.data.items || [item.title];
    for (const todoText of items) {
      await createTodoItem({
        text: todoText,
        completedAt: null,
        priority: item.data.priority || 'medium',
        dueDate: item.data.dueDate,
        showOnDashboard: !!item.data.dueDate
      });
    }
  };

  return (
    <div className="smart-view" style={{ padding: '2rem', maxWidth: '1200px', margin: '0 auto' }}>
      {/* Header */}
      <div style={{ marginBottom: '2rem' }}>
        <h1 style={{ fontSize: '2.5rem', fontWeight: 800, margin: '0 0 0.5rem', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <span>✨</span>
          <span>Smart Features</span>
        </h1>
        <p style={{ fontSize: '1.1rem', color: '#6b7280', margin: 0 }}>
          AI-powered tools to help you capture and organize information faster
        </p>
      </div>

      {/* Features Grid */}
      <div style={{ display: 'grid', gap: '1.5rem', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))' }}>
        {/* Voice Commands */}
        <div
          style={{
            background: 'linear-gradient(135deg, #dbeafe 0%, #bfdbfe 100%)',
            borderRadius: '1rem',
            padding: '2rem',
            border: '2px solid #3b82f6',
            boxShadow: '0 4px 12px rgba(59, 130, 246, 0.2)'
          }}
        >
          <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>🎤</div>
          <h2 style={{ fontSize: '1.5rem', fontWeight: 700, margin: '0 0 0.5rem' }}>Voice Commands</h2>
          <p style={{ fontSize: '0.95rem', color: '#1e40af', marginBottom: '1.5rem' }}>
            Speak to create tasks, events, journal entries, and more. Just press the button and start talking!
          </p>
          <VoiceCommandButton />
        </div>

        {/* History / Audit Log */}
        <div
          style={{
            background: 'linear-gradient(135deg, #fef3c7 0%, #fde68a 100%)',
            borderRadius: '1rem',
            padding: '2rem',
            border: '2px solid #f59e0b',
            boxShadow: '0 4px 12px rgba(245, 158, 11, 0.2)'
          }}
        >
          <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>📋</div>
          <h2 style={{ fontSize: '1.5rem', fontWeight: 700, margin: '0 0 0.5rem' }}>History & Audit</h2>
          <p style={{ fontSize: '0.95rem', color: '#92400e', marginBottom: '1.5rem' }}>
            View all your voice commands and image scans. Track what was created and when.
          </p>
          <button
            onClick={() => setShowHistory(true)}
            style={{
              width: '100%',
              padding: '1rem',
              background: '#f59e0b',
              color: 'white',
              border: 'none',
              borderRadius: '0.5rem',
              fontWeight: 600,
              cursor: 'pointer',
              fontSize: '1rem'
            }}
          >
            📜 View History
          </button>
        </div>

        {/* Quick Scan */}
        <div
          style={{
            background: 'linear-gradient(135deg, #d1fae5 0%, #a7f3d0 100%)',
            borderRadius: '1rem',
            padding: '2rem',
            border: '2px solid #10b981',
            boxShadow: '0 4px 12px rgba(16, 185, 129, 0.2)'
          }}
        >
          <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>🆓</div>
          <h2 style={{ fontSize: '1.5rem', fontWeight: 700, margin: '0 0 0.5rem' }}>Quick Scan</h2>
          <p style={{ fontSize: '0.95rem', color: '#065f46', marginBottom: '1.5rem' }}>
            Free instant OCR. Scan birthday cards, invitations, handwritten notes, receipts, and more.
          </p>
          <button
            onClick={() => handleScanClick('quick')}
            disabled={isScanning}
            style={{
              width: '100%',
              padding: '1rem',
              background: '#10b981',
              color: 'white',
              border: 'none',
              borderRadius: '0.5rem',
              fontWeight: 600,
              cursor: isScanning ? 'not-allowed' : 'pointer',
              fontSize: '1rem'
            }}
          >
            {isScanning ? '⏳ Scanning...' : '📸 Start Quick Scan'}
          </button>
        </div>

        {/* Smart Scan */}
        <div
          style={{
            background: 'linear-gradient(135deg, #f3e8ff 0%, #e9d5ff 100%)',
            borderRadius: '1rem',
            padding: '2rem',
            border: '2px solid #8b5cf6',
            boxShadow: '0 4px 12px rgba(139, 92, 246, 0.2)'
          }}
        >
          <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>✨</div>
          <h2 style={{ fontSize: '1.5rem', fontWeight: 700, margin: '0 0 0.5rem' }}>Smart Scan</h2>
          <p style={{ fontSize: '0.95rem', color: '#6b21a8', marginBottom: '1.5rem' }}>
            AI-powered analysis with GPT-4 Vision. Best accuracy for complex images and multiple items.
          </p>
          <button
            onClick={() => handleScanClick('smart')}
            disabled={isScanning}
            style={{
              width: '100%',
              padding: '1rem',
              background: '#8b5cf6',
              color: 'white',
              border: 'none',
              borderRadius: '0.5rem',
              fontWeight: 600,
              cursor: isScanning ? 'not-allowed' : 'pointer',
              fontSize: '1rem'
            }}
          >
            {isScanning ? '⏳ Scanning...' : '✨ Start Smart Scan'}
          </button>
        </div>
      </div>

      {/* Info Section */}
      <div
        style={{
          marginTop: '2rem',
          padding: '1.5rem',
          background: '#f9fafb',
          borderRadius: '1rem',
          border: '1px solid #e5e7eb'
        }}
      >
        <h3 style={{ fontSize: '1.1rem', fontWeight: 600, margin: '0 0 1rem' }}>What can you scan?</h3>
        <div style={{ display: 'grid', gap: '0.75rem', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', fontSize: '0.9rem' }}>
          <div>🎂 Birthday cards</div>
          <div>💌 Invitations</div>
          <div>📝 Handwritten TODOs</div>
          <div>🧾 Receipts</div>
          <div>🎁 Gift cards</div>
          <div>📋 Meeting notes</div>
          <div>🏃 Workout plans</div>
          <div>💊 Prescriptions</div>
        </div>
      </div>

      {/* Modals */}
      <ImageScanModal
        show={showImageScanModal}
        onClose={() => setShowImageScanModal(false)}
        onImageSelected={handleImageSelected}
        mode={scanMode}
      />

      <SmartSuggestionsModal
        show={showSuggestionsModal}
        onClose={() => setShowSuggestionsModal(false)}
        result={scanResult}
        onCreateItem={handleCreateItem}
      />

      {/* AI Consent Warning */}
      {showWarning && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0, 0, 0, 0.7)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            padding: '1rem'
          }}
          onClick={() => setShowWarning(false)}
        >
          <div
            style={{
              background: 'white',
              borderRadius: '1rem',
              maxWidth: '500px',
              padding: '2rem',
              boxShadow: '0 20px 60px rgba(0,0,0,0.3)'
            }}
            onClick={e => e.stopPropagation()}
          >
            <div style={{ fontSize: '3rem', textAlign: 'center', marginBottom: '1rem' }}>⚠️</div>
            <h2 style={{ fontSize: '1.5rem', fontWeight: 700, margin: '0 0 1rem', textAlign: 'center' }}>
              Enable AI Scanning?
            </h2>
            <p style={{ fontSize: '0.95rem', color: '#4b5563', marginBottom: '1rem', lineHeight: 1.6 }}>
              Smart Scan uses OpenAI's GPT-4 Vision API to analyze your images. Your images will be sent to OpenAI's servers for processing.
            </p>
            <p style={{ fontSize: '0.95rem', color: '#4b5563', marginBottom: '1.5rem', lineHeight: 1.6 }}>
              <strong>Privacy:</strong> Images are encrypted before sending. Avoid scanning sensitive documents like passwords or credit cards.
            </p>
            <div style={{ display: 'flex', gap: '1rem' }}>
              <button
                onClick={() => setShowWarning(false)}
                style={{
                  flex: 1,
                  padding: '0.875rem',
                  background: '#f3f4f6',
                  color: '#374151',
                  border: '2px solid #e5e7eb',
                  borderRadius: '0.5rem',
                  fontWeight: 600,
                  cursor: 'pointer'
                }}
              >
                Cancel
              </button>
              <button
                onClick={handleEnableAI}
                style={{
                  flex: 1,
                  padding: '0.875rem',
                  background: '#8b5cf6',
                  color: 'white',
                  border: 'none',
                  borderRadius: '0.5rem',
                  fontWeight: 600,
                  cursor: 'pointer'
                }}
              >
                Enable & Continue
              </button>
            </div>
          </div>
        </div>
      )}

      {/* History Modal */}
      <VoiceCommandHistory
        isOpen={showHistory}
        onClose={() => setShowHistory(false)}
      />
    </div>
  );
};

export default SmartView;

/**
 * Image Scan Modal
 * 
 * Allows users to capture/upload images for scanning
 * Supports: Camera, File Upload, Paste from Clipboard
 */

import React, { useState, useRef } from 'react';
import Portal from './Portal';
import { ScanMode } from '../services/imageScanning/types';

interface ImageScanModalProps {
  show: boolean;
  onClose: () => void;
  onImageSelected: (file: File, mode: ScanMode) => void;
  mode: ScanMode;
}

const ImageScanModal: React.FC<ImageScanModalProps> = ({
  show,
  onClose,
  onImageSelected,
  mode
}) => {
  const [preview, setPreview] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [useCamera, setUseCamera] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);

  React.useEffect(() => {
    if (!show) {
      cleanup();
    }
  }, [show]);

  // Handle paste from clipboard
  React.useEffect(() => {
    const handlePaste = (e: ClipboardEvent) => {
      if (!show) return;
      
      const items = e.clipboardData?.items;
      if (!items) return;

      for (let i = 0; i < items.length; i++) {
        if (items[i].type.indexOf('image') !== -1) {
          const blob = items[i].getAsFile();
          if (blob) {
            handleFileSelect(blob);
          }
        }
      }
    };

    document.addEventListener('paste', handlePaste);
    return () => document.removeEventListener('paste', handlePaste);
  }, [show]);

  const cleanup = () => {
    if (stream) {
      stream.getTracks().forEach(track => track.stop());
      setStream(null);
    }
    setPreview(null);
    setSelectedFile(null);
    setUseCamera(false);
  };

  const handleFileSelect = (file: File | Blob) => {
    const imageFile = file instanceof File ? file : new File([file], 'pasted-image.png', { type: file.type });
    setSelectedFile(imageFile);
    
    const reader = new FileReader();
    reader.onload = (e) => {
      setPreview(e.target?.result as string);
    };
    reader.readAsDataURL(imageFile);
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      handleFileSelect(file);
    }
  };

  const startCamera = async () => {
    try {
      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: { 
          facingMode: 'environment',
          width: { ideal: 1920 },
          height: { ideal: 1080 }
        }
      });
      setStream(mediaStream);
      setUseCamera(true);
      
      // Wait for next tick to ensure video element is rendered
      setTimeout(() => {
        if (videoRef.current) {
          videoRef.current.srcObject = mediaStream;
          videoRef.current.play().catch(err => {
            console.error('Error playing video:', err);
          });
        }
      }, 100);
    } catch (error) {
      console.error('Camera access denied:', error);
      alert('Camera access denied. Please allow camera permissions.');
    }
  };

  const capturePhoto = () => {
    if (!videoRef.current) return;

    const canvas = document.createElement('canvas');
    canvas.width = videoRef.current.videoWidth;
    canvas.height = videoRef.current.videoHeight;
    const ctx = canvas.getContext('2d');
    
    if (ctx) {
      ctx.drawImage(videoRef.current, 0, 0);
      canvas.toBlob((blob) => {
        if (blob) {
          handleFileSelect(blob);
          cleanup();
        }
      }, 'image/jpeg', 0.95);
    }
  };

  const handleScan = () => {
    if (selectedFile) {
      onImageSelected(selectedFile, mode);
      onClose();
      cleanup();
    }
  };

  if (!show) return null;

  const modeConfig = {
    quick: {
      title: '🆓 Quick Scan',
      subtitle: 'Free • Instant • Local Processing',
      color: '#10b981',
      description: 'Uses Tesseract OCR running in your browser. Good for simple text extraction.'
    },
    smart: {
      title: '✨ Smart Scan',
      subtitle: 'AI-Powered • Most Accurate',
      color: '#8b5cf6',
      description: 'Uses GPT-4 Vision AI. Best for complex images and multiple items.'
    }
  };

  const config = modeConfig[mode];

  return (
    <Portal>
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
        onClick={onClose}
      >
        <div
          style={{
            background: 'white',
            borderRadius: '1rem',
            maxWidth: '600px',
            width: '100%',
            maxHeight: '90vh',
            overflow: 'auto',
            boxShadow: '0 20px 60px rgba(0,0,0,0.3)'
          }}
          onClick={e => e.stopPropagation()}
        >
          {/* Header */}
          <div
            style={{
              padding: '1.5rem',
              borderBottom: '2px solid #e5e7eb',
              background: `linear-gradient(135deg, ${config.color}15, ${config.color}05)`
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div>
                <h2 style={{ margin: 0, fontSize: '1.5rem', fontWeight: 700 }}>{config.title}</h2>
                <p style={{ margin: '0.25rem 0 0', fontSize: '0.875rem', color: '#6b7280' }}>
                  {config.subtitle}
                </p>
              </div>
              <button
                onClick={onClose}
                style={{
                  background: 'none',
                  border: 'none',
                  fontSize: '1.5rem',
                  cursor: 'pointer',
                  color: '#6b7280'
                }}
              >
                ✕
              </button>
            </div>
            <p style={{ margin: '1rem 0 0', fontSize: '0.875rem', color: '#4b5563' }}>
              {config.description}
            </p>
          </div>

          {/* Content */}
          <div style={{ padding: '1.5rem' }}>
            {!preview && !useCamera && (
              <div>
                {/* Options */}
                <div style={{ display: 'grid', gap: '1rem', marginBottom: '1.5rem' }}>
                  {/* Camera */}
                  <button
                    onClick={startCamera}
                    style={{
                      padding: '1.5rem',
                      background: 'linear-gradient(135deg, #dbeafe, #bfdbfe)',
                      border: '2px solid #3b82f6',
                      borderRadius: '0.75rem',
                      cursor: 'pointer',
                      textAlign: 'left',
                      transition: 'transform 0.2s'
                    }}
                    onMouseEnter={(e) => e.currentTarget.style.transform = 'scale(1.02)'}
                    onMouseLeave={(e) => e.currentTarget.style.transform = 'scale(1)'}
                  >
                    <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>📷</div>
                    <div style={{ fontWeight: 600, fontSize: '1.1rem', marginBottom: '0.25rem' }}>
                      Take Photo
                    </div>
                    <div style={{ fontSize: '0.875rem', color: '#1e40af' }}>
                      Use your device camera
                    </div>
                  </button>

                  {/* Upload */}
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    style={{
                      padding: '1.5rem',
                      background: 'linear-gradient(135deg, #fef3c7, #fde68a)',
                      border: '2px solid #f59e0b',
                      borderRadius: '0.75rem',
                      cursor: 'pointer',
                      textAlign: 'left',
                      transition: 'transform 0.2s'
                    }}
                    onMouseEnter={(e) => e.currentTarget.style.transform = 'scale(1.02)'}
                    onMouseLeave={(e) => e.currentTarget.style.transform = 'scale(1)'}
                  >
                    <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>📁</div>
                    <div style={{ fontWeight: 600, fontSize: '1.1rem', marginBottom: '0.25rem' }}>
                      Upload File
                    </div>
                    <div style={{ fontSize: '0.875rem', color: '#92400e' }}>
                      Choose from your device
                    </div>
                  </button>

                  {/* Paste */}
                  <div
                    style={{
                      padding: '1.5rem',
                      background: 'linear-gradient(135deg, #f3e8ff, #e9d5ff)',
                      border: '2px dashed #a855f7',
                      borderRadius: '0.75rem',
                      textAlign: 'left'
                    }}
                  >
                    <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>📋</div>
                    <div style={{ fontWeight: 600, fontSize: '1.1rem', marginBottom: '0.25rem' }}>
                      Paste Image
                    </div>
                    <div style={{ fontSize: '0.875rem', color: '#6b21a8' }}>
                      Press Ctrl+V (or Cmd+V) to paste from clipboard
                    </div>
                  </div>
                </div>

                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleFileInputChange}
                  style={{ display: 'none' }}
                />
              </div>
            )}

            {/* Camera View */}
            {useCamera && !preview && (
              <div>
                <video
                  ref={videoRef}
                  autoPlay
                  playsInline
                  muted
                  style={{
                    width: '100%',
                    borderRadius: '0.75rem',
                    marginBottom: '1rem',
                    background: '#000',
                    minHeight: '300px',
                    objectFit: 'cover'
                  }}
                  onLoadedMetadata={(e) => {
                    // Ensure video plays when metadata is loaded
                    const video = e.currentTarget;
                    video.play().catch(err => console.error('Play error:', err));
                  }}
                />
                <div style={{ display: 'flex', gap: '1rem' }}>
                  <button
                    onClick={capturePhoto}
                    style={{
                      flex: 1,
                      padding: '1rem',
                      background: config.color,
                      color: 'white',
                      border: 'none',
                      borderRadius: '0.5rem',
                      fontWeight: 600,
                      cursor: 'pointer',
                      fontSize: '1rem'
                    }}
                  >
                    📸 Capture
                  </button>
                  <button
                    onClick={cleanup}
                    style={{
                      padding: '1rem 1.5rem',
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
                </div>
              </div>
            )}

            {/* Preview */}
            {preview && (
              <div>
                <img
                  src={preview}
                  alt="Preview"
                  style={{
                    width: '100%',
                    borderRadius: '0.75rem',
                    marginBottom: '1rem',
                    boxShadow: '0 4px 12px rgba(0,0,0,0.1)'
                  }}
                />
                <div style={{ display: 'flex', gap: '1rem' }}>
                  <button
                    onClick={handleScan}
                    style={{
                      flex: 1,
                      padding: '1rem',
                      background: config.color,
                      color: 'white',
                      border: 'none',
                      borderRadius: '0.5rem',
                      fontWeight: 600,
                      cursor: 'pointer',
                      fontSize: '1rem'
                    }}
                  >
                    {mode === 'quick' ? '🆓 Scan Now' : '✨ Scan with AI'}
                  </button>
                  <button
                    onClick={() => {
                      setPreview(null);
                      setSelectedFile(null);
                    }}
                    style={{
                      padding: '1rem 1.5rem',
                      background: '#f3f4f6',
                      color: '#374151',
                      border: '2px solid #e5e7eb',
                      borderRadius: '0.5rem',
                      fontWeight: 600,
                      cursor: 'pointer'
                    }}
                  >
                    Retake
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </Portal>
  );
};

export default ImageScanModal;

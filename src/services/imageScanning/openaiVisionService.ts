/**
 * OpenAI Vision Service
 * 
 * AI-powered image analysis using GPT-4 Vision
 */

import { ScanResult, ExtractedItem } from './types';

/**
 * Scan image using OpenAI GPT-4 Vision API
 */
export async function scanImageWithOpenAI(
  imageFile: File | Blob
): Promise<ScanResult> {
  const startTime = Date.now();
  
  try {
    // Convert image to base64
    const base64Image = await fileToBase64(imageFile);
    
    // Call our Vercel API endpoint
    const response = await fetch('/api/scan-image', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        image: base64Image,
        mimeType: imageFile.type
      })
    });
    
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to scan image');
    }
    
    const result = await response.json();
    
    return {
      success: true,
      mode: 'smart',
      items: result.items || [],
      rawText: result.rawText,
      processingTime: Date.now() - startTime
    };
  } catch (error) {
    console.error('OpenAI Vision error:', error);
    return {
      success: false,
      mode: 'smart',
      items: [],
      error: error instanceof Error ? error.message : 'AI scan failed',
      processingTime: Date.now() - startTime
    };
  }
}

/**
 * Convert File/Blob to base64 string
 */
function fileToBase64(file: File | Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const base64 = reader.result as string;
      // Remove data:image/...;base64, prefix
      const base64Data = base64.split(',')[1] || base64;
      resolve(base64Data);
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

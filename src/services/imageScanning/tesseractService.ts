/**
 * Tesseract OCR Service
 * 
 * Free, client-side OCR using Tesseract.js
 */

import { createWorker } from 'tesseract.js';
import { ScanResult, ExtractedItem } from './types';
import { parseExtractedText } from './imageParser';

let worker: any = null;

/**
 * Initialize Tesseract worker (lazy loading)
 */
async function getWorker() {
  if (!worker) {
    worker = await createWorker('eng');
  }
  return worker;
}

/**
 * Scan image using free Tesseract OCR
 */
export async function scanImageWithTesseract(
  imageFile: File | Blob | string
): Promise<ScanResult> {
  const startTime = Date.now();
  
  try {
    const tesseractWorker = await getWorker();
    
    // Perform OCR
    const { data } = await tesseractWorker.recognize(imageFile);
    const rawText = data.text;
    
    if (!rawText || rawText.trim().length === 0) {
      return {
        success: false,
        mode: 'quick',
        items: [],
        error: 'No text found in image',
        processingTime: Date.now() - startTime
      };
    }
    
    // Parse extracted text into structured items
    const items = parseExtractedText(rawText, 'quick');
    
    return {
      success: true,
      mode: 'quick',
      items,
      rawText,
      processingTime: Date.now() - startTime
    };
  } catch (error) {
    console.error('Tesseract OCR error:', error);
    return {
      success: false,
      mode: 'quick',
      items: [],
      error: error instanceof Error ? error.message : 'OCR failed',
      processingTime: Date.now() - startTime
    };
  }
}

/**
 * Cleanup worker when done
 */
export async function cleanupTesseract() {
  if (worker) {
    await worker.terminate();
    worker = null;
  }
}

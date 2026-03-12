import { ExtractedItem } from '../src/services/imageScanning/types';
import { applyRateLimit, RATE_LIMITS } from './utils/rateLimit';
import { handleApiError, createErrorResponse } from './utils/errorHandler';

// OpenAI GPT-4 Vision API endpoint
// Expects: OPENAI_API_KEY in environment variables

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  // SEC-001: Apply rate limiting for image processing (expensive operation)
  if (!applyRateLimit(req, res, RATE_LIMITS.imageProcessing)) {
    return; // Response already sent by rate limiter
  }

  const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

  if (!OPENAI_API_KEY) {
    res.status(500).json(createErrorResponse('CONFIG_ERROR', 'Image scanning not available'));
    return;
  }

  try {
    const { image, mimeType, hints } = req.body;

    if (!image) {
      res.status(400).json(createErrorResponse('VALIDATION_ERROR', 'No image provided'));
      return;
    }
    
    // FEAT-002: Extract context hints
    const keywords = hints?.keywords || '';
    const isFinancial = hints?.isFinancial || false;
    
    // SEC-005: Validate image size (max 10MB base64 ~ 7.5MB raw)
    if (image.length > 10 * 1024 * 1024) {
      res.status(400).json(createErrorResponse('VALIDATION_ERROR', 'Image too large (max 10MB)'));
      return;
    }
    
    // Validate MIME type
    const allowedMimeTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
    if (mimeType && !allowedMimeTypes.includes(mimeType)) {
      res.status(400).json(createErrorResponse('VALIDATION_ERROR', 'Invalid image type'));
      return;
    }

    // SEC-005: Validate base64 format (basic check for valid base64 characters)
    const base64Regex = /^[A-Za-z0-9+/=]+$/;
    if (!base64Regex.test(image)) {
      res.status(400).json(createErrorResponse('VALIDATION_ERROR', 'Invalid image encoding'));
      return;
    }

    // Call OpenAI Vision API
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${OPENAI_API_KEY}`
      },
      body: JSON.stringify({
        model: 'gpt-4-vision-preview',
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'text',
                text: `Analyze this image and extract structured information. Identify what type of document/image this is and extract relevant data.
${keywords ? `\nIMPORTANT CONTEXT from user: "${keywords}" - use this hint to help identify the source/content.` : ''}
${isFinancial ? `\nIMPORTANT: User has indicated this is FINANCIAL INFORMATION - prioritize extracting financial/investment data.` : ''}

Possible types:
- Birthday card (extract: person name, date, message)
- Invitation (extract: event name, date, time, location, host)
- Handwritten TODO list (extract: list of tasks)
- Receipt (extract: merchant, amount, date, items)
- Gift card (extract: brand, amount, code/pin)
- Meeting notes (extract: action items, attendees, notes)
- Workout plan (extract: goal, exercises, target)
- Prescription (extract: medicine name, dosage, frequency)
- Financial screenshot - brokerage/investment app screenshot (Robinhood, Fidelity, Schwab, Vanguard, E*Trade, Zerodha, Groww, Coinbase, etc.)
  Extract: source app name, accounts with names/types/balances, individual holdings with symbol/name/quantity/value/change

Return a JSON array of objects with this structure:
{
  "type": "birthday|invitation|todo|receipt|gift-card|meeting-notes|workout-plan|prescription|financial-screenshot",
  "confidence": 0.0-1.0,
  "title": "Short title",
  "description": "Brief description",
  "data": { ...type-specific fields... }
}

For financial-screenshot type, data should be:
{
  "source": "robinhood|fidelity|schwab|vanguard|etrade|zerodha|groww|coinbase|unknown",
  "accounts": [{ "name": "...", "type": "brokerage|retirement|savings|checking|crypto|other", "balance": number, "currency": "USD|INR|...", "holdings": [{ "symbol": "AAPL", "name": "Apple Inc", "quantity": 10, "value": 1500.00, "change": 25.50, "changePercent": 1.5 }] }],
  "totalValue": number
}

If multiple items are found (e.g., birthday AND a task to buy a gift), return multiple objects.
If nothing relevant is found, return an empty array.

IMPORTANT: Return ONLY valid JSON, no markdown, no explanations.`
              },
              {
                type: 'image_url',
                image_url: {
                  url: `data:${mimeType || 'image/jpeg'};base64,${image}`
                }
              }
            ]
          }
        ],
        max_tokens: 1000,
        temperature: 0.3
      })
    });

    if (!response.ok) {
      const error = await response.json();
      console.error('OpenAI API error:', error);
      res.status(500).json(createErrorResponse('EXTERNAL_API_ERROR', 'Image analysis failed'));
      return;
    }

    const data = await response.json() as any;
    const content = data.choices?.[0]?.message?.content;

    if (!content) {
      res.status(500).json(createErrorResponse('EXTERNAL_API_ERROR', 'No response from AI'));
      return;
    }

    // Parse JSON response
    let parsedItems: any[] = [];
    try {
      // Remove markdown code blocks if present
      const cleanContent = content.replace(/```json\n?|\n?```/g, '').trim();
      parsedItems = JSON.parse(cleanContent);
    } catch (parseError) {
      console.error('Failed to parse OpenAI response:', content);
      res.status(500).json(createErrorResponse('PARSE_ERROR', 'Failed to process AI response'));
      return;
    }

    // Transform to ExtractedItem format
    const items: ExtractedItem[] = parsedItems.map((item: any) => ({
      id: crypto.randomUUID(),
      type: item.type || 'todo',
      confidence: item.confidence || 0.8,
      title: item.title || 'Untitled',
      description: item.description,
      data: item.data || {},
      suggestedDestination: getSuggestedDestination(item.type),
      icon: getIcon(item.type)
    }));

    res.status(200).json({
      items,
      rawText: content
    });
  } catch (err: unknown) {
    handleApiError(res, err, 'scan-image', 500, 'SERVER_ERROR');
  }
}

function getSuggestedDestination(type: string): 'event' | 'task' | 'todo' | 'journal' | 'safe' | 'gift-card' | 'resolution' | 'financial-import' {
  const mapping: Record<string, 'event' | 'task' | 'todo' | 'journal' | 'safe' | 'gift-card' | 'resolution' | 'financial-import'> = {
    'birthday': 'event',
    'invitation': 'event',
    'todo': 'todo',
    'receipt': 'safe',
    'gift-card': 'gift-card',
    'meeting-notes': 'task',
    'workout-plan': 'resolution',
    'prescription': 'safe',
    'financial-screenshot': 'financial-import'
  };
  return mapping[type] || 'task';
}

function getIcon(type: string): string {
  const icons: Record<string, string> = {
    'birthday': '🎂',
    'invitation': '💌',
    'todo': '✅',
    'receipt': '🧾',
    'gift-card': '🎁',
    'meeting-notes': '📋',
    'workout-plan': '🏃',
    'prescription': '💊',
    'financial-screenshot': '📊'
  };
  return icons[type] || '📄';
}

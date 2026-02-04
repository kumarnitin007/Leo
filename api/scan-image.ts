import { ExtractedItem } from '../src/services/imageScanning/types';

// OpenAI GPT-4 Vision API endpoint
// Expects: OPENAI_API_KEY in environment variables

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

  if (!OPENAI_API_KEY) {
    res.status(500).json({ error: 'OpenAI API key not configured' });
    return;
  }

  try {
    const { image, mimeType } = req.body;

    if (!image) {
      res.status(400).json({ error: 'No image provided' });
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

Possible types:
- Birthday card (extract: person name, date, message)
- Invitation (extract: event name, date, time, location, host)
- Handwritten TODO list (extract: list of tasks)
- Receipt (extract: merchant, amount, date, items)
- Gift card (extract: brand, amount, code/pin)
- Meeting notes (extract: action items, attendees, notes)
- Workout plan (extract: goal, exercises, target)
- Prescription (extract: medicine name, dosage, frequency)

Return a JSON array of objects with this structure:
{
  "type": "birthday|invitation|todo|receipt|gift-card|meeting-notes|workout-plan|prescription",
  "confidence": 0.0-1.0,
  "title": "Short title",
  "description": "Brief description",
  "data": { ...type-specific fields... }
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
      res.status(500).json({ error: 'OpenAI API request failed' });
      return;
    }

    const data = await response.json() as any;
    const content = data.choices?.[0]?.message?.content;

    if (!content) {
      res.status(500).json({ error: 'No response from OpenAI' });
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
      res.status(500).json({ error: 'Failed to parse AI response' });
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
  } catch (err: any) {
    console.error('Scan image endpoint error:', err);
    res.status(500).json({ error: err.message || 'Unknown error' });
  }
}

function getSuggestedDestination(type: string): 'event' | 'task' | 'todo' | 'journal' | 'safe' | 'gift-card' | 'resolution' {
  const mapping: Record<string, 'event' | 'task' | 'todo' | 'journal' | 'safe' | 'gift-card' | 'resolution'> = {
    'birthday': 'event',
    'invitation': 'event',
    'todo': 'todo',
    'receipt': 'safe',
    'gift-card': 'gift-card',
    'meeting-notes': 'task',
    'workout-plan': 'resolution',
    'prescription': 'safe'
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
    'prescription': '💊'
  };
  return icons[type] || '📄';
}

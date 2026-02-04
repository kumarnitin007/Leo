/**
 * Image Parser
 * 
 * Parses extracted text into structured data items
 */

import { ExtractedItem, ScanMode } from './types';

/**
 * Parse extracted text into structured items
 * Uses pattern matching and heuristics for quick scan
 */
export function parseExtractedText(text: string, mode: ScanMode): ExtractedItem[] {
  const items: ExtractedItem[] = [];
  const lines = text.split('\n').map(l => l.trim()).filter(l => l.length > 0);
  
  // Birthday detection
  const birthdayItem = detectBirthday(text, lines);
  if (birthdayItem) items.push(birthdayItem);
  
  // Invitation detection
  const invitationItem = detectInvitation(text, lines);
  if (invitationItem) items.push(invitationItem);
  
  // TODO list detection
  const todoItems = detectTodoList(text, lines);
  items.push(...todoItems);
  
  // Receipt detection
  const receiptItem = detectReceipt(text, lines);
  if (receiptItem) items.push(receiptItem);
  
  // Gift card detection
  const giftCardItem = detectGiftCard(text, lines);
  if (giftCardItem) items.push(giftCardItem);
  
  return items;
}

function detectBirthday(text: string, lines: string[]): ExtractedItem | null {
  const birthdayKeywords = /birthday|bday|b-day|born|anniversary/i;
  const datePattern = /(\d{1,2}[-\/]\d{1,2}[-\/]\d{2,4})|(\w+ \d{1,2},? \d{4})|(\d{1,2} \w+ \d{4})/i;
  
  if (!birthdayKeywords.test(text)) return null;
  
  const dateMatch = text.match(datePattern);
  if (!dateMatch) return null;
  
  // Extract name (heuristic: look for "Happy Birthday [Name]" or similar)
  const nameMatch = text.match(/(?:happy birthday|birthday|for)\s+(?:to\s+)?([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)/i);
  const personName = nameMatch ? nameMatch[1] : 'Unknown';
  
  return {
    id: crypto.randomUUID(),
    type: 'birthday',
    confidence: 0.7,
    title: `${personName}'s Birthday`,
    description: `Birthday on ${dateMatch[0]}`,
    data: {
      personName,
      date: parseDate(dateMatch[0]),
      recurring: true
    },
    suggestedDestination: 'event',
    icon: '🎂'
  };
}

function detectInvitation(text: string, lines: string[]): ExtractedItem | null {
  const inviteKeywords = /invited?|invitation|please join|you'?re invited|rsvp|event/i;
  const datePattern = /(\d{1,2}[-\/]\d{1,2}[-\/]\d{2,4})|(\w+ \d{1,2},? \d{4})|(\d{1,2} \w+ \d{4})/i;
  const timePattern = /(\d{1,2}:\d{2}\s*(?:am|pm)?)|(\d{1,2}\s*(?:am|pm))/i;
  
  if (!inviteKeywords.test(text)) return null;
  
  const dateMatch = text.match(datePattern);
  const timeMatch = text.match(timePattern);
  
  // Extract event name (first significant line or after "to")
  const eventNameMatch = text.match(/(?:to|for)\s+([A-Z][^.!?\n]{5,50})/i);
  const eventName = eventNameMatch ? eventNameMatch[1].trim() : lines[0] || 'Event';
  
  // Extract location
  const locationMatch = text.match(/(?:at|location|venue|address)[\s:]+([^\n]{10,100})/i);
  const location = locationMatch ? locationMatch[1].trim() : undefined;
  
  return {
    id: crypto.randomUUID(),
    type: 'invitation',
    confidence: 0.75,
    title: eventName,
    description: `Event on ${dateMatch ? dateMatch[0] : 'TBD'}`,
    data: {
      eventName,
      date: dateMatch ? parseDate(dateMatch[0]) : undefined,
      time: timeMatch ? timeMatch[0] : undefined,
      location
    },
    suggestedDestination: 'event',
    icon: '💌'
  };
}

function detectTodoList(text: string, lines: string[]): ExtractedItem[] {
  const todoKeywords = /todo|task|to-do|checklist|action items?/i;
  const bulletPattern = /^[\-\*\•\◦\▪\□\☐]\s+(.+)$/;
  const numberPattern = /^\d+[\.\)]\s+(.+)$/;
  
  const hasTodoKeyword = todoKeywords.test(text);
  const todoItems: string[] = [];
  
  for (const line of lines) {
    const bulletMatch = line.match(bulletPattern);
    const numberMatch = line.match(numberPattern);
    
    if (bulletMatch) {
      todoItems.push(bulletMatch[1].trim());
    } else if (numberMatch) {
      todoItems.push(numberMatch[1].trim());
    }
  }
  
  if (todoItems.length === 0 && !hasTodoKeyword) return [];
  
  // If we found bullets/numbers, create individual tasks
  if (todoItems.length > 0) {
    return todoItems.map(item => ({
      id: crypto.randomUUID(),
      type: 'todo',
      confidence: 0.8,
      title: item,
      data: {
        items: [item],
        priority: 'medium'
      },
      suggestedDestination: 'todo',
      icon: '✅'
    }));
  }
  
  // Otherwise, create a single TODO with all text
  return [{
    id: crypto.randomUUID(),
    type: 'todo',
    confidence: 0.6,
    title: 'Task List',
    description: `${lines.length} items found`,
    data: {
      items: lines.slice(0, 10), // Max 10 items
      priority: 'medium'
    },
    suggestedDestination: 'todo',
    icon: '📝'
  }];
}

function detectReceipt(text: string, lines: string[]): ExtractedItem | null {
  const receiptKeywords = /receipt|invoice|total|subtotal|tax|payment/i;
  const amountPattern = /\$?\s*(\d+[,\.]?\d*\.?\d{2})/;
  
  if (!receiptKeywords.test(text)) return null;
  
  // Find total amount
  const totalMatch = text.match(/(?:total|amount|paid)[\s:]*\$?\s*(\d+[,\.]?\d*\.?\d{2})/i);
  const amount = totalMatch ? parseFloat(totalMatch[1].replace(/,/g, '')) : 0;
  
  // Find merchant (usually first line or after "from")
  const merchantMatch = text.match(/^([A-Z][^\n]{3,40})/m);
  const merchant = merchantMatch ? merchantMatch[1].trim() : 'Unknown Merchant';
  
  // Find date
  const dateMatch = text.match(/(\d{1,2}[-\/]\d{1,2}[-\/]\d{2,4})/);
  
  return {
    id: crypto.randomUUID(),
    type: 'receipt',
    confidence: 0.7,
    title: `Receipt from ${merchant}`,
    description: `$${amount.toFixed(2)}`,
    data: {
      merchant,
      amount,
      currency: 'USD',
      date: dateMatch ? parseDate(dateMatch[0]) : new Date().toISOString().split('T')[0]
    },
    suggestedDestination: 'safe',
    icon: '🧾'
  };
}

function detectGiftCard(text: string, lines: string[]): ExtractedItem | null {
  const giftCardKeywords = /gift card|giftcard|gift certificate|voucher/i;
  const amountPattern = /\$?\s*(\d+(?:\.\d{2})?)/;
  const codePattern = /(?:code|pin|number)[\s:]*([A-Z0-9\-]{6,20})/i;
  
  if (!giftCardKeywords.test(text)) return null;
  
  const amountMatch = text.match(amountPattern);
  const amount = amountMatch ? parseFloat(amountMatch[1]) : 0;
  
  const codeMatch = text.match(codePattern);
  const code = codeMatch ? codeMatch[1] : undefined;
  
  // Brand detection (common brands)
  const brands = ['Amazon', 'Starbucks', 'Target', 'Walmart', 'iTunes', 'Google Play', 'Steam'];
  const brand = brands.find(b => new RegExp(b, 'i').test(text)) || 'Unknown Brand';
  
  return {
    id: crypto.randomUUID(),
    type: 'gift-card',
    confidence: 0.75,
    title: `${brand} Gift Card`,
    description: `$${amount.toFixed(2)}${code ? ' • Code found' : ''}`,
    data: {
      brand,
      amount,
      currency: 'USD',
      code
    },
    suggestedDestination: 'gift-card',
    icon: '🎁'
  };
}

/**
 * Parse date string to YYYY-MM-DD format
 */
function parseDate(dateStr: string): string {
  try {
    // Try to parse various date formats
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) {
      return new Date().toISOString().split('T')[0];
    }
    return date.toISOString().split('T')[0];
  } catch {
    return new Date().toISOString().split('T')[0];
  }
}

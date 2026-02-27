import React, { useState, useRef } from 'react';
import { getSupabaseClient } from '../lib/supabase';

interface TemplateModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const ReferenceCalendarTemplateModal: React.FC<TemplateModalProps> = ({ isOpen, onClose }) => {
  const [activeTab, setActiveTab] = useState<'json' | 'csv' | 'import' | 'enrich'>('json');
  const [isImporting, setIsImporting] = useState(false);
  const [importStatus, setImportStatus] = useState<string>('');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const enrichInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  const jsonTemplate = {
    "_instructions": "Use this template to add new calendars and days to the system. Replace example values with your data.",
    "calendar": {
      "id": "example-calendar-id",
      "name": "Example Calendar Name",
      "description": "Description of what this calendar represents",
      "country": "IN",
      "calendarType": "holiday|festival|religious|cultural|birthday|observance",
      "domain": "holiday",
      "geography": "IN",
      "religion": null,
      "isPreloaded": true,
      "version": "1.0",
      "source": "Source/Authority"
    },
    "events": [
      {
        "day": {
          "id": "UNIQUE-EVENT-ID",
          "date": "2026-01-26",
          "monthDay": "01-26",
          "month": 1,
          "day": 26,
          "recurrence": "YEARLY",
          "calendarSystem": "gregorian"
        },
        "event": {
          "name": "Event Name",
          "category": "holiday",
          "importanceLevel": 95,
          "significance": "Why this day is important",
          "description": "Detailed description",
          "states": ["State Name"],
          "localCustoms": ["Custom 1", "Custom 2"],
          "tags": ["tag1", "tag2"],
          "visualTheme": {
            "primaryColor": "#FF9800",
            "mood": "celebratory",
            "icon": "flag"
          },
          "media": {
            "imageUrl": "https://example.com/image.jpg",
            "infoUrl": "https://example.com/info"
          }
        }
      }
    ]
  };

  const csvTemplate = `calendar_id,calendar_name,calendar_description,calendar_domain,calendar_type,geography,religion,day_id,date,month,day_of_month,event_name,event_category,importance_level,event_description,tags,states,primary_color,mood,icon,image_url,source
example-calendar,Example Calendar,Description here,holiday,reference,IN,,EX-01-26,2026-01-26,1,26,Event Name,holiday,95,Detailed description,tag1|tag2,State Name,#FF9800,celebratory,flag,https://example.com/image.jpg,Source Name`;

  const downloadFile = (content: string, filename: string, mimeType: string) => {
    const blob = new Blob([content], { type: mimeType });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(url);
  };

  const handleEnrichmentUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!file.name.endsWith('.json')) {
      setImportStatus('❌ Error: Please upload a JSON file');
      return;
    }

    setIsImporting(true);
    setImportStatus('📖 Reading enrichment file...');

    try {
      const fileContent = await file.text();
      const enrichmentData = JSON.parse(fileContent);

      if (!enrichmentData.event_name || !enrichmentData.day_identifier) {
        throw new Error('Invalid format. Must have "event_name" and "day_identifier" properties.');
      }

      setImportStatus('🔄 Importing enrichment data...');

      const client = await getSupabaseClient();
      const { day_identifier } = enrichmentData;

      let insertedCount = 0;

      // Insert facts
      if (enrichmentData.facts && Array.isArray(enrichmentData.facts)) {
        for (const fact of enrichmentData.facts) {
          const { error } = await client.from('myday_calendar_facts').insert({
            day_identifier,
            title: fact.title,
            description: fact.description,
            icon: fact.icon || '📚',
            display_order: fact.order || 1,
          });
          if (!error || error.code === '23505') insertedCount++;
        }
      }

      // Insert statistics
      if (enrichmentData.statistics && Array.isArray(enrichmentData.statistics)) {
        for (const stat of enrichmentData.statistics) {
          const { error } = await client.from('myday_calendar_statistics').insert({
            day_identifier,
            label: stat.label,
            value: stat.value,
            description: stat.description,
            icon: stat.icon || '📊',
            display_order: stat.order || 1,
          });
          if (!error || error.code === '23505') insertedCount++;
        }
      }

      // Insert tips
      if (enrichmentData.tips && Array.isArray(enrichmentData.tips)) {
        for (const tip of enrichmentData.tips) {
          const { error } = await client.from('myday_calendar_tips').insert({
            day_identifier,
            category: tip.category || 'general',
            title: tip.title,
            description: tip.description,
            icon: tip.icon || '💡',
            display_order: tip.order || 1,
          });
          if (!error || error.code === '23505') insertedCount++;
        }
      }

      // Insert timeline
      if (enrichmentData.timeline && Array.isArray(enrichmentData.timeline)) {
        for (const item of enrichmentData.timeline) {
          const { error } = await client.from('myday_calendar_timeline_items').insert({
            day_identifier,
            year: item.year,
            title: item.title,
            description: item.description,
            icon: item.icon || '📅',
            display_order: item.order || 1,
          });
          if (!error || error.code === '23505') insertedCount++;
        }
      }

      // Insert quick ideas
      if (enrichmentData.quick_ideas && Array.isArray(enrichmentData.quick_ideas)) {
        for (const idea of enrichmentData.quick_ideas) {
          const { error } = await client.from('myday_calendar_quick_ideas').insert({
            day_identifier,
            category: idea.category || 'activity',
            title: idea.title,
            description: idea.description,
            icon: idea.icon || '🎯',
            difficulty: idea.difficulty || 'medium',
            time_required: idea.time_required || null,
            display_order: idea.order || 1,
          });
          if (!error || error.code === '23505') insertedCount++;
        }
      }

      // Insert external resources
      if (enrichmentData.external_resources && Array.isArray(enrichmentData.external_resources)) {
        for (const resource of enrichmentData.external_resources) {
          const { error } = await client.from('myday_calendar_external_resources').insert({
            day_identifier,
            title: resource.title,
            url: resource.url,
            resource_type: resource.type || 'article',
            description: resource.description || null,
            display_order: resource.order || 1,
          });
          if (!error || error.code === '23505') insertedCount++;
        }
      }

      setImportStatus(`✅ Enrichment complete! ${insertedCount} items imported for "${enrichmentData.event_name}"`);

      setTimeout(() => {
        setImportStatus('');
        setIsImporting(false);
        if (enrichInputRef.current) enrichInputRef.current.value = '';
      }, 3000);

    } catch (err) {
      console.error('Enrichment import error:', err);
      setImportStatus(`❌ Error: ${err instanceof Error ? err.message : 'Unknown error'}`);
      setIsImporting(false);
      if (enrichInputRef.current) enrichInputRef.current.value = '';
    }
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!file.name.endsWith('.json')) {
      setImportStatus('❌ Error: Please upload a JSON file');
      return;
    }

    setIsImporting(true);
    setImportStatus('📖 Reading file...');

    try {
      const fileContent = await file.text();
      const calendarData = JSON.parse(fileContent);

      // Validate structure
      if (!calendarData.calendar || !calendarData.events) {
        throw new Error('Invalid calendar format. Must have "calendar" and "events" properties.');
      }

      setImportStatus('🔄 Importing calendar...');

      const client = await getSupabaseClient();
      const { calendar, events } = calendarData;

      // Insert calendar (omit calendar_type to use DB default or find valid values)
      const insertData: any = {
        id: calendar.id,
        name: calendar.name,
        description: calendar.description || null,
        geography: calendar.geography || calendar.country || null,
        domain: calendar.domain || 'holiday',
        religion: calendar.religion || null,
        is_preloaded: calendar.isPreloaded ?? true,
        is_user_editable: false,
        version: calendar.version || '1.0',
        source: calendar.source || null,
      };

      // Only add calendar_type if it's one of the known valid values
      // Try common values: 'reference', 'user-created'
      if (calendar.calendarType === 'reference' || calendar.calendarType === 'user-created') {
        insertData.calendar_type = calendar.calendarType;
      } else {
        insertData.calendar_type = 'reference'; // default
      }

      const { error: calendarError } = await client
        .from('myday_reference_calendars')
        .insert(insertData);

      if (calendarError) {
        if (calendarError.code === '23505') {
          throw new Error(`Calendar "${calendar.id}" already exists. Please delete it first or use a different ID.`);
        }
        if (calendarError.code === '42501') {
          throw new Error(`Permission denied. Reference calendars can only be imported by database admins.\n\nTo import these calendars:\n1. Go to Supabase Dashboard → SQL Editor\n2. Use the SQL import script (see documentation)\n\nOR contact your database administrator.`);
        }
        if (calendarError.code === '42P01') {
          throw new Error(`Database tables not found. Please create the reference calendar tables first.\n\nRun this SQL in Supabase:\nSee database/create-reference-calendar-tables.sql`);
        }
        throw calendarError;
      }

      setImportStatus(`✅ Calendar created. Importing ${events.length} events...`);

      // Insert days (using actual schema with anchor_type/anchor_key)
      let successCount = 0;
      let errorCount = 0;

      for (const eventData of events) {
        try {
          const { day, event } = eventData;

          // Parse date from monthDay if available
          let dateValue = '2026-01-01'; // Default date (required field)
          let yearValue = 2026;
          let monthValue = 1;
          let dayOfMonthValue = 1;
          
          if (day.monthDay) {
            const [m, d] = day.monthDay.split('-').map(Number);
            monthValue = m;
            dayOfMonthValue = d;
            dateValue = `2026-${day.monthDay}`;
          }
          // For lunar/variable dates without monthDay, use Jan 1 as placeholder

          // Insert day with actual table schema
          const { error: dayError } = await client
            .from('myday_reference_days')
            .insert({
              id: day.id,
              date: dateValue,
              year: yearValue,
              month: monthValue,
              day_of_month: dayOfMonthValue,
              calendar_system: day.calendarSystem || 'gregorian',
              anchor_type: 'calendar',
              anchor_key: calendar.id,
              event_name: event.name,
              event_description: event.significance || null,
              event_category: event.category || null,
              importance_level: event.importanceLevel || 50,
              significance: event.significance || null,
              local_customs: event.localCustoms || null,
              observance_rule: day.rule || day.note || null,
              tags: event.crossAssociationTags || event.tags || null,
              primary_color: event.visualTheme?.primaryColor || null,
              mood: event.visualTheme?.mood || null,
              icon: event.visualTheme?.icon || null,
              image_url: event.media?.imageUrl || null,
              urls: event.media?.infoUrl ? { info: event.media.infoUrl } : null,
              source: calendar.source || null,
            });

          if (dayError && dayError.code !== '23505') {
            throw dayError;
          }

          // Also insert into myday_calendar_days to link day to calendar
          const { error: linkError } = await client
            .from('myday_calendar_days')
            .insert({
              calendar_id: calendar.id,
              day_id: day.id,
              sequence_order: successCount + 1,
            });

          if (linkError && linkError.code !== '23505') {
            console.warn('Link insert warning:', linkError);
          }

          // Insert enrichment for enhanced modal display
          const dayIdentifier = event.name
            .toLowerCase()
            .replace(/['']/g, '')
            .replace(/\s+/g, '-')
            .replace(/[^a-z0-9-]/g, '');

          const primaryColor = event.visualTheme?.primaryColor || '#3b82f6';

          // Map event category to valid template_category
          const categoryMap: Record<string, string> = {
            'national': 'patriotic',
            'federal': 'patriotic',
            'festival': 'celebration',
            'traditional': 'cultural',
            'cultural': 'cultural',
            'awareness': 'awareness',
            'awareness-month': 'awareness',
            'high-holy-day': 'religious',
            'pilgrimage-festival': 'religious',
            'religious': 'religious',
            'championship': 'celebration',
            'tournament': 'celebration',
            'race': 'celebration',
            'multi-sport': 'celebration',
            'observance': 'awareness',
            'social': 'romantic',
            'family': 'celebration',
          };
          const templateCategory = categoryMap[event.category || ''] || 'cultural';

          const { error: enrichmentError } = await client
            .from('myday_calendar_enrichments')
            .insert({
              day_identifier: dayIdentifier,
              day_name: event.name,
              template_category: templateCategory,
              primary_color: primaryColor,
              secondary_color: primaryColor,
              gradient_start: primaryColor,
              gradient_end: primaryColor,
              icon_emoji: event.visualTheme?.icon || '📅',
              tagline: event.significance || event.name,
              origin_story: event.significance || null,
              importance_percentage: event.importanceLevel || 50,
              is_major_holiday: (event.importanceLevel || 50) >= 90,
            });

          if (enrichmentError && enrichmentError.code !== '23505') {
            console.warn('Enrichment insert warning:', enrichmentError);
          }

          successCount++;
          setImportStatus(`✅ Imported ${successCount}/${events.length} events...`);
        } catch (err) {
          console.error('Error importing event:', eventData, err);
          errorCount++;
        }
      }

      setImportStatus(
        `✅ Import complete! ${successCount} events imported successfully.${
          errorCount > 0 ? ` ${errorCount} errors (see console).` : ''
        }`
      );

      // Reset file input
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }

      // Auto-close after 3 seconds on success
      setTimeout(() => {
        setImportStatus('');
        setIsImporting(false);
      }, 3000);
    } catch (error: any) {
      console.error('Import error:', error);
      setImportStatus(`❌ Error: ${error.message || 'Failed to import calendar'}`);
      setIsImporting(false);

      // Reset file input
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: 'rgba(0, 0, 0, 0.5)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 1000
    }}>
      <div style={{
        backgroundColor: 'white',
        borderRadius: '12px',
        boxShadow: '0 10px 40px rgba(0, 0, 0, 0.2)',
        maxWidth: '900px',
        width: '90%',
        maxHeight: '85vh',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden'
      }}>
        {/* Header */}
        <div style={{
          padding: '20px 24px',
          borderBottom: '1px solid #e0e0e0',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          backgroundColor: '#fafafa'
        }}>
          <h2 style={{ margin: 0, fontSize: '18px', fontWeight: 600 }}>
            📋 Calendar Import Templates
          </h2>
          <button
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              fontSize: '24px',
              cursor: 'pointer',
              color: '#666'
            }}
          >
            ✕
          </button>
        </div>

        {/* Content */}
        <div style={{ flex: 1, overflow: 'auto', padding: '24px' }}>
          {/* Tabs */}
          <div style={{ display: 'flex', gap: '12px', marginBottom: '20px', borderBottom: '2px solid #e0e0e0', flexWrap: 'wrap' }}>
            <button
              onClick={() => setActiveTab('import')}
              style={{
                padding: '12px 16px',
                border: 'none',
                background: activeTab === 'import' ? '#4CAF50' : 'transparent',
                color: activeTab === 'import' ? 'white' : '#666',
                cursor: 'pointer',
                borderRadius: '4px 4px 0 0',
                fontWeight: 500,
                fontSize: '14px'
              }}
            >
              📤 Import Calendar
            </button>
            <button
              onClick={() => setActiveTab('enrich')}
              style={{
                padding: '12px 16px',
                border: 'none',
                background: activeTab === 'enrich' ? '#9333ea' : 'transparent',
                color: activeTab === 'enrich' ? 'white' : '#666',
                cursor: 'pointer',
                borderRadius: '4px 4px 0 0',
                fontWeight: 500,
                fontSize: '14px'
              }}
            >
              ✨ Enrich Event
            </button>
            <button
              onClick={() => setActiveTab('json')}
              style={{
                padding: '12px 16px',
                border: 'none',
                background: activeTab === 'json' ? '#1976D2' : 'transparent',
                color: activeTab === 'json' ? 'white' : '#666',
                cursor: 'pointer',
                borderRadius: '4px 4px 0 0',
                fontWeight: 500,
                fontSize: '14px'
              }}
            >
              JSON Template
            </button>
            <button
              onClick={() => setActiveTab('csv')}
              style={{
                padding: '12px 16px',
                border: 'none',
                background: activeTab === 'csv' ? '#1976D2' : 'transparent',
                color: activeTab === 'csv' ? 'white' : '#666',
                cursor: 'pointer',
                borderRadius: '4px 4px 0 0',
                fontWeight: 500,
                fontSize: '14px'
              }}
            >
              CSV Template
            </button>
          </div>

          {/* Instructions */}
          {activeTab === 'import' ? (
            <div style={{
              backgroundColor: '#E8F5E9',
              border: '1px solid #81C784',
              borderRadius: '4px',
              padding: '12px',
              marginBottom: '16px',
              fontSize: '13px',
              color: '#2E7D32'
            }}>
              <strong>Import Calendar:</strong> Upload a JSON file containing calendar and event data. The file will be imported directly into your database.
            </div>
          ) : activeTab === 'enrich' ? (
            <div style={{
              backgroundColor: '#faf5ff',
              border: '1px solid #c084fc',
              borderRadius: '4px',
              padding: '12px',
              marginBottom: '16px',
              fontSize: '13px',
              color: '#7e22ce'
            }}>
              <strong>Enrich Event:</strong> Upload a JSON file with rich content (facts, tips, timeline, etc.) for an existing event. Use the ChatGPT prompt below to generate this data.
            </div>
          ) : (
            <div style={{
              backgroundColor: '#E3F2FD',
              border: '1px solid #90CAF9',
              borderRadius: '4px',
              padding: '12px',
              marginBottom: '16px',
              fontSize: '13px',
              color: '#1565C0'
            }}>
              <strong>Instructions:</strong> Use these templates to prepare calendar data for import. Fill in your data following the template structure, then save as {activeTab === 'json' ? 'JSON' : 'CSV'} and use the Import tab to upload.
            </div>
          )}

          {/* Template Content */}
          {activeTab === 'import' ? (
            <div>
              <h3 style={{ marginTop: 0, marginBottom: '16px', fontSize: '14px' }}>Upload Calendar JSON File</h3>
              
              <input
                ref={fileInputRef}
                type="file"
                accept=".json"
                onChange={handleFileUpload}
                disabled={isImporting}
                style={{ display: 'none' }}
              />
              
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={isImporting}
                style={{
                  width: '100%',
                  padding: '40px 20px',
                  backgroundColor: isImporting ? '#e0e0e0' : '#f5f5f5',
                  border: '2px dashed #bdbdbd',
                  borderRadius: '8px',
                  cursor: isImporting ? 'not-allowed' : 'pointer',
                  fontSize: '16px',
                  color: '#666',
                  fontWeight: 500,
                  transition: 'all 0.2s',
                }}
                onMouseEnter={(e) => {
                  if (!isImporting) {
                    e.currentTarget.style.backgroundColor = '#e8f5e9';
                    e.currentTarget.style.borderColor = '#4CAF50';
                  }
                }}
                onMouseLeave={(e) => {
                  if (!isImporting) {
                    e.currentTarget.style.backgroundColor = '#f5f5f5';
                    e.currentTarget.style.borderColor = '#bdbdbd';
                  }
                }}
              >
                {isImporting ? '⏳ Importing...' : '📤 Click to Select JSON File'}
              </button>

              {importStatus && (
                <div style={{
                  marginTop: '16px',
                  padding: '12px',
                  backgroundColor: importStatus.startsWith('❌') ? '#ffebee' : '#e8f5e9',
                  border: `1px solid ${importStatus.startsWith('❌') ? '#ef5350' : '#81C784'}`,
                  borderRadius: '4px',
                  fontSize: '13px',
                  color: importStatus.startsWith('❌') ? '#c62828' : '#2E7D32',
                  whiteSpace: 'pre-wrap'
                }}>
                  {importStatus}
                </div>
              )}

              <div style={{ marginTop: '20px', fontSize: '13px', color: '#666' }}>
                <strong>Available Calendars to Import:</strong>
                <ul style={{ marginTop: '8px', paddingLeft: '20px' }}>
                  <li><code>reference/china-public-holidays.json</code> - 7 events</li>
                  <li><code>reference/jewish-holidays-global.json</code> - 7 events</li>
                  <li><code>reference/health-awareness-calendar.json</code> - 12 events</li>
                  <li><code>reference/major-sports-events.json</code> - 12 events</li>
                  <li><code>reference/environmental-observances.json</code> - 13 events</li>
                </ul>
                <p style={{ marginTop: '12px', fontSize: '12px', color: '#999' }}>
                  💡 Tip: Import one calendar at a time. If a calendar already exists, delete it first from the Reference Calendars browser.
                </p>
              </div>
            </div>
          ) : activeTab === 'enrich' ? (
            <div>
              <h3 style={{ marginTop: 0, marginBottom: '16px', fontSize: '14px' }}>Enrich Event with Rich Content</h3>
              
              <div style={{
                backgroundColor: '#fef3c7',
                border: '1px solid #fbbf24',
                borderRadius: '8px',
                padding: '16px',
                marginBottom: '20px',
                fontSize: '13px',
                color: '#92400e'
              }}>
                <strong>📋 Step-by-Step Process:</strong>
                <ol style={{ marginTop: '8px', marginBottom: 0, paddingLeft: '20px' }}>
                  <li>Copy the ChatGPT prompt from <code>CHATGPT_PROMPT_ENRICHMENT.md</code></li>
                  <li>Replace <code>[EVENT_NAME]</code> with your event (e.g., "Chinese New Year")</li>
                  <li>Paste into ChatGPT and get the JSON response</li>
                  <li>Save the JSON to a file (e.g., <code>chinese-new-year-enrichment.json</code>)</li>
                  <li>Upload the file here</li>
                </ol>
              </div>

              <input
                ref={enrichInputRef}
                type="file"
                accept=".json"
                onChange={handleEnrichmentUpload}
                disabled={isImporting}
                style={{ display: 'none' }}
              />
              
              <button
                onClick={() => enrichInputRef.current?.click()}
                disabled={isImporting}
                style={{
                  width: '100%',
                  padding: '40px 20px',
                  backgroundColor: isImporting ? '#e0e0e0' : '#faf5ff',
                  border: '2px dashed #c084fc',
                  borderRadius: '8px',
                  cursor: isImporting ? 'not-allowed' : 'pointer',
                  fontSize: '16px',
                  color: '#7e22ce',
                  fontWeight: 500,
                  transition: 'all 0.2s',
                }}
                onMouseEnter={(e) => {
                  if (!isImporting) {
                    e.currentTarget.style.backgroundColor = '#f3e8ff';
                    e.currentTarget.style.borderColor = '#9333ea';
                  }
                }}
                onMouseLeave={(e) => {
                  if (!isImporting) {
                    e.currentTarget.style.backgroundColor = '#faf5ff';
                    e.currentTarget.style.borderColor = '#c084fc';
                  }
                }}
              >
                {isImporting ? '⏳ Importing enrichment...' : '✨ Click to Select Enrichment JSON'}
              </button>

              {importStatus && (
                <div style={{
                  marginTop: '16px',
                  padding: '12px',
                  backgroundColor: importStatus.startsWith('❌') ? '#ffebee' : '#f0fdf4',
                  border: `1px solid ${importStatus.startsWith('❌') ? '#ef5350' : '#86efac'}`,
                  borderRadius: '4px',
                  fontSize: '13px',
                  color: importStatus.startsWith('❌') ? '#c62828' : '#166534',
                  whiteSpace: 'pre-wrap'
                }}>
                  {importStatus}
                </div>
              )}

              <div style={{ marginTop: '20px', fontSize: '13px', color: '#666' }}>
                <strong>What gets imported:</strong>
                <ul style={{ marginTop: '8px', paddingLeft: '20px' }}>
                  <li>📚 Facts - Interesting trivia and history</li>
                  <li>📊 Statistics - Numbers and data points</li>
                  <li>💡 Tips - Pro tips for celebration, gifts, activities</li>
                  <li>📅 Timeline - Historical milestones</li>
                  <li>🎯 Quick Ideas - Activities, recipes, crafts</li>
                  <li>🔗 External Resources - Articles, videos, links</li>
                </ul>
                <p style={{ marginTop: '12px', fontSize: '12px', color: '#999' }}>
                  💡 This enrichment data makes event modals much more engaging and informative!
                </p>
              </div>
            </div>
          ) : activeTab === 'json' ? (
            <div>
              <h3 style={{ marginTop: 0, marginBottom: '12px', fontSize: '14px' }}>JSON Format</h3>
              <pre style={{
                backgroundColor: '#f5f5f5',
                border: '1px solid #ddd',
                borderRadius: '4px',
                padding: '12px',
                overflow: 'auto',
                fontSize: '12px',
                lineHeight: '1.4',
                maxHeight: '300px'
              }}>
                {JSON.stringify(jsonTemplate, null, 2)}
              </pre>
              <div style={{ marginTop: '12px', fontSize: '13px', color: '#666' }}>
                <strong>Key Points:</strong>
                <ul style={{ marginTop: '8px', paddingLeft: '20px' }}>
                  <li>calendar.id: Unique identifier (lowercase-hyphenated)</li>
                  <li>day.id: Format like "COUNTRY-MONTH-DAY" (e.g., "IN-01-26") or "GLOBAL-MONTH-DAY"</li>
                  <li>date: Full date in YYYY-MM-DD format</li>
                  <li>month & day_of_month: Numeric values</li>
                  <li>importanceLevel: 1-100 scale (100 = most important)</li>
                  <li>All optional fields can be omitted</li>
                </ul>
              </div>
            </div>
          ) : (
            <div>
              <h3 style={{ marginTop: 0, marginBottom: '12px', fontSize: '14px' }}>CSV Format</h3>
              <pre style={{
                backgroundColor: '#f5f5f5',
                border: '1px solid #ddd',
                borderRadius: '4px',
                padding: '12px',
                overflow: 'auto',
                fontSize: '12px',
                lineHeight: '1.4',
                maxHeight: '300px',
                fontFamily: 'monospace'
              }}>
                {csvTemplate}
              </pre>
              <div style={{ marginTop: '12px', fontSize: '13px', color: '#666' }}>
                <strong>Key Points:</strong>
                <ul style={{ marginTop: '8px', paddingLeft: '20px' }}>
                  <li>Use comma (,) as delimiter</li>
                  <li>Use pipe (|) for multi-value fields (tags, states, customs)</li>
                  <li>Leave blank fields empty (just use commas)</li>
                  <li>One row = one day in one calendar</li>
                  <li>Dates must be YYYY-MM-DD format</li>
                  <li>No quotes around values unless they contain commas</li>
                </ul>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div style={{
          padding: '16px 24px',
          borderTop: '1px solid #e0e0e0',
          backgroundColor: '#fafafa',
          display: 'flex',
          gap: '12px',
          justifyContent: 'flex-end'
        }}>
          <button
            onClick={() => {
              if (activeTab === 'json') {
                downloadFile(
                  JSON.stringify(jsonTemplate, null, 2),
                  'calendar-template.json',
                  'application/json'
                );
              } else {
                downloadFile(csvTemplate, 'calendar-template.csv', 'text/csv');
              }
            }}
            style={{
              padding: '10px 20px',
              backgroundColor: '#4CAF50',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
              fontWeight: 500,
              fontSize: '14px'
            }}
          >
            ⬇️ Download {activeTab === 'json' ? 'JSON' : 'CSV'} Template
          </button>
          <button
            onClick={onClose}
            style={{
              padding: '10px 20px',
              backgroundColor: '#999',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
              fontWeight: 500,
              fontSize: '14px'
            }}
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

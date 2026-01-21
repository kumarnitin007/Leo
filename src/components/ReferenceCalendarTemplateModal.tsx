import React, { useState } from 'react';

interface TemplateModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const ReferenceCalendarTemplateModal: React.FC<TemplateModalProps> = ({ isOpen, onClose }) => {
  const [activeTab, setActiveTab] = useState<'json' | 'csv'>('json');

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
          <div style={{ display: 'flex', gap: '12px', marginBottom: '20px', borderBottom: '2px solid #e0e0e0' }}>
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
          <div style={{
            backgroundColor: '#E3F2FD',
            border: '1px solid #90CAF9',
            borderRadius: '4px',
            padding: '12px',
            marginBottom: '16px',
            fontSize: '13px',
            color: '#1565C0'
          }}>
            <strong>Instructions:</strong> Use these templates to prepare calendar data for import. Fill in your data following the template structure, then save as {activeTab === 'json' ? 'JSON' : 'CSV'} and use the loader script or Supabase SQL Editor to import.
          </div>

          {/* Template Content */}
          {activeTab === 'json' ? (
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

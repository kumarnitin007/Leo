/**
 * TOTP QR Code Component
 * 
 * Displays QR code for TOTP setup
 */

import React, { useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { generateTOTPURI } from '../utils/totp';

interface TOTPQRCodeProps {
  secret: string;
  issuer: string;
  account: string;
}

const TOTPQRCode: React.FC<TOTPQRCodeProps> = ({ secret, issuer, account }) => {
  const [showQR, setShowQR] = useState(false);

  if (!secret || !issuer || !account) return null;

  return (
    <div style={{ marginBottom: '1rem' }}>
      <button
        type="button"
        onClick={() => setShowQR(!showQR)}
        style={{
          padding: '0.75rem 1.5rem',
          backgroundColor: '#3b82f6',
          color: 'white',
          border: 'none',
          borderRadius: '0.5rem',
          cursor: 'pointer',
          marginBottom: '1rem'
        }}
      >
        {showQR ? 'Hide QR Code' : 'Show QR Code'}
      </button>
      {showQR && (
        <div style={{
          padding: '1rem',
          backgroundColor: '#f9fafb',
          borderRadius: '0.5rem',
          textAlign: 'center'
        }}>
          <QRCodeSVG
            value={generateTOTPURI(secret, issuer, account)}
            size={200}
          />
          <p style={{ margin: '1rem 0 0 0', fontSize: '0.875rem', opacity: 0.7 }}>
            Scan with your authenticator app
          </p>
        </div>
      )}
    </div>
  );
};

export default TOTPQRCode;


import React from 'react';
import './DemoBanner.css';

interface DemoBannerProps {
  levelIcon: string;
  levelName: string;
}

const DemoBanner: React.FC<DemoBannerProps> = ({ levelIcon, levelName }) => {
  return (
    <div className="demo-banner">
      <div className="demo-banner-content">
        <span className="demo-banner-icon">{levelIcon}</span>
        <div className="demo-banner-text">
          <strong>{levelName} Account</strong>
          <span className="demo-banner-subtitle">Read-only access • Limited features</span>
        </div>
      </div>
      <button className="demo-banner-upgrade">
        Upgrade
      </button>
    </div>
  );
};

export default DemoBanner;

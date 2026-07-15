/**
 * FormCollapsible
 *
 * Progressive-disclosure section used inside the create/edit slide-over forms.
 * Mandatory fields stay visible; optional/advanced fields live inside a
 * collapsed section that the user can expand when needed.
 */

import React, { useState } from 'react';

interface FormCollapsibleProps {
  title: string;
  subtitle?: string;
  defaultOpen?: boolean;
  children: React.ReactNode;
}

const FormCollapsible: React.FC<FormCollapsibleProps> = ({
  title,
  subtitle,
  defaultOpen = false,
  children,
}) => {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div className={`form-collapsible ${open ? 'open' : ''}`}>
      <button
        type="button"
        className="form-collapsible-header"
        onClick={() => setOpen(o => !o)}
        aria-expanded={open}
      >
        <span className="form-collapsible-chevron" aria-hidden>▸</span>
        <span className="form-collapsible-title">{title}</span>
        {subtitle && <span className="form-collapsible-subtitle">{subtitle}</span>}
      </button>
      {open && <div className="form-collapsible-body">{children}</div>}
    </div>
  );
};

export default FormCollapsible;

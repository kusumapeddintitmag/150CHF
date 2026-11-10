import { useState } from 'react';
import { AlertTriangle, Check, CircleHelp, Languages, Settings, UserRound, X } from 'lucide-react';

function TopNavigation() {
  const [menu, setMenu] = useState(null);
  const item = (key, icon, label) => (
    <div className="nav-menu-wrap">
      <button onClick={() => setMenu(menu === key ? null : key)}>{icon} {label} <span>⌄</span></button>
      {menu === key && <div className="nav-menu"><button type="button">Companies</button><button type="button">Currencies</button></div>}
    </div>
  );
  return <nav className="top-nav">{item('masters', <Settings size={12} />, 'Masters')}{item('users', <UserRound size={12} />, 'User Management')}<div className="nav-menu-wrap language"><button onClick={() => setMenu(menu === 'language' ? null : 'language')}><Languages size={12} /> Language <span>⌄</span></button>{menu === 'language' && <div className="nav-menu"><button type="button">English</button><button type="button">Hindi</button></div>}</div></nav>;
}

function CompanyDialog({ type, message, onCancel, onConfirm, onDiscard }) {
  const isConfirmation = type === 'confirm';
  const isDiscard = type === 'discard';
  return (
    <div className="modal-backdrop company-dialog-backdrop">
      <section className={`company-dialog ${isConfirmation || isDiscard ? 'confirmation-dialog' : 'error-dialog'}`} role="dialog" aria-modal="true" aria-labelledby="company-dialog-title">
        <div className="company-dialog-icon">{isConfirmation || isDiscard ? <CircleHelp size={25} /> : <AlertTriangle size={25} />}</div>
        <h2 id="company-dialog-title">{isConfirmation ? 'Confirm Save' : isDiscard ? 'Discard Changes?' : 'Error'}</h2>
        <p>{isConfirmation ? 'Are you sure you want to save this record?' : isDiscard ? 'Your unsaved changes will be removed. Do you want to leave this screen?' : message}</p>
        <div className="company-dialog-actions">
          {isConfirmation
            ? <><button type="button" onClick={onCancel}><X size={13} /> No</button><button type="button" className="dialog-confirm" onClick={onConfirm}><Check size={13} /> Yes, Save</button></>
            : isDiscard
              ? <><button type="button" onClick={onCancel}>Stay</button><button type="button" className="dialog-confirm" onClick={onDiscard}>Discard</button></>
              : <button type="button" className="dialog-confirm" onClick={onCancel}>OK</button>}
        </div>
      </section>
    </div>
  );
}

export { TopNavigation, CompanyDialog };

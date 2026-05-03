import { useState } from 'react';
import { HelpCircle } from 'lucide-react';
import { useViewport } from '../../../hooks/useViewport';
import { useHelpContext } from './HelpContext';
import MapHelpPanel from './MapHelpPanel';

// ── Constants ─────────────────────────────────────────────────────────────────

/** The default anchor id that exists in ultrawide mode's content column */
const DEFAULT_HELP_ANCHOR = 'default-help-anchor';

// ── Component ─────────────────────────────────────────────────────────────────

interface MapHelpButtonProps {
  /** Optional style overrides for the button */
  className?: string;
  style?: React.CSSProperties;
}

export function MapHelpButton({ className, style }: MapHelpButtonProps) {
  const { isUltrawide } = useViewport();
  const helpCtx = useHelpContext();
  const [panelOpen, setPanelOpen] = useState(false);

  const handleClick = () => {
    if (isUltrawide) {
      // On ultrawide the help content is always visible in the right column;
      // just scroll-focus the default anchor.
      helpCtx.focus(DEFAULT_HELP_ANCHOR);
    } else {
      setPanelOpen(true);
    }
  };

  const anchors = helpCtx.getAnchors('map-help');

  return (
    <>
      <button
        onClick={handleClick}
        className={[
          'backdrop-blur-sm text-white p-3 rounded-full transition-all duration-300 hover:scale-110',
          className ?? '',
        ].join(' ')}
        style={style}
        title="Ayuda"
        aria-label="Abrir ayuda"
      >
        <HelpCircle className="w-5 h-5" />
      </button>

      {panelOpen && (
        <MapHelpPanel
          anchors={anchors}
          onClose={() => setPanelOpen(false)}
        />
      )}
    </>
  );
}

export default MapHelpButton;

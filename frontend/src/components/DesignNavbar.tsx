import type { LandingTheme } from '../themes/landing-themes';
import './DesignNavbar.css';

// ---------------------------------------------------------------------------
// Contract 2 — contracts/typescript-interfaces.md
// ---------------------------------------------------------------------------

export interface DesignNavbarProps {
  /** Ordered list of all design variants */
  themes: readonly LandingTheme[];
  /** The id of the currently active theme */
  activeThemeId: string;
  /** Called when the user selects a different design variant */
  onThemeChange: (themeId: string) => void;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * DesignNavbar — Feature 039-landing-page-redesign
 *
 * Persistent horizontally-scrollable navbar listing all design variants.
 * Controlled component: active state is driven entirely by `activeThemeId` prop.
 * Keyboard navigable (Enter/Space to activate focused tab).
 * ARIA: role="tablist" wrapper, role="tab" buttons, aria-selected state.
 */
export function DesignNavbar({ themes, activeThemeId, onThemeChange }: DesignNavbarProps) {
  return (
    <nav
      className="design-navbar"
      role="tablist"
      aria-label="Design variants"
    >
      <div className="design-navbar__strip">
        {themes.map(theme => {
          const isActive = theme.id === activeThemeId;
          return (
            <button
              key={theme.id}
              role="tab"
              aria-selected={isActive}
              aria-label={theme.name}
              className={`design-navbar__tab${isActive ? ' active' : ''}`}
              onClick={() => onThemeChange(theme.id)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  onThemeChange(theme.id);
                }
              }}
              type="button"
            >
              <span
                className="design-navbar__swatch"
                style={{ background: theme.palette.ctaBg }}
                aria-hidden="true"
              />
              {theme.name}
            </button>
          );
        })}
      </div>
    </nav>
  );
}

/**
 * PluginNavEntry — navigation entry per installed plugin (T018)
 * Feature 030: Plugin Architecture
 *
 * Renders a nav button for a single plugin. Active state styling applied
 * when isActive is true. 44×44 px minimum touch target (Constitution §III).
 */

import type { PluginManifest } from '../../plugin-api/index';
import { useTranslation } from '../../i18n/index';

export interface PluginNavEntryProps {
  plugin: PluginManifest;
  isActive: boolean;
  onSelect: () => void;
}

export function PluginNavEntry({ plugin, isActive, onSelect }: PluginNavEntryProps) {
  const { t, tDynamic } = useTranslation();
  const translatedName = tDynamic(`plugin.name.${plugin.id}`, plugin.name);
  return (
    <button
      className={`plugin-nav-entry${isActive ? ' plugin-nav-entry--active' : ''}`}
      onClick={onSelect}
      aria-pressed={isActive}
      aria-label={t('nav.open_plugin_aria', { name: translatedName })}
    >
      {translatedName}
      {plugin.origin === 'imported' && (
        <span className="plugin-nav-entry__badge" aria-label={t('nav.user_installed_aria')}>↑</span>
      )}
    </button>
  );
}

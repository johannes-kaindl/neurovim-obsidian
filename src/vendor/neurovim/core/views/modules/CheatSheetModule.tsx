import React from 'react';
import { getOrderedCategories } from '../../data/cheatsheet';

interface CheatSheetModuleProps {
  unlockedCategories: string[];
  activeCategory: string | null;
  collapsedSections: Record<string, boolean>;
  onToggleSection: (id: string) => void;
}

export function CheatSheetModule({
  unlockedCategories,
  activeCategory,
  collapsedSections,
  onToggleSection,
}: CheatSheetModuleProps) {
  const categories = getOrderedCategories(unlockedCategories, activeCategory);

  return (
    <div className="nv-module nv-module-cheatsheet">
      {categories.map(cat => {
        const isCollapsed = collapsedSections[cat.id] ?? false;
        const isActive = cat.id === activeCategory;
        return (
          <div key={cat.id} className={`nv-cs-category ${isActive ? 'nv-cs-active' : ''}`}>
            <button
              className="nv-cs-header"
              onClick={() => onToggleSection(cat.id)}
            >
              <span>{isCollapsed ? '▸' : '▾'} {cat.label}</span>
            </button>
            {!isCollapsed && (
              <div className="nv-cs-body">
                {cat.groups.map(group => (
                  <div key={group.label} className="nv-cs-group">
                    <div className="nv-cs-group-label">{group.label}</div>
                    {group.keys.map(k => (
                      <div key={k.key} className="nv-cs-key-row">
                        <code className="nv-cs-key">{k.key}</code>
                        <span className="nv-cs-desc">{k.description}</span>
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

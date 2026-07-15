/** Hub pane tabs. State lives in main.ts (not persisted) and flows in as a prop. */
export type HubTab = 'nexus' | 'missions' | 'guide' | 'uplink';

/** The uplink tab disappears when the LLM is unconfigured — fall back to home. */
export function effectiveTab(active: HubTab, uplinkVisible: boolean): HubTab {
  return active === 'uplink' && !uplinkVisible ? 'nexus' : active;
}

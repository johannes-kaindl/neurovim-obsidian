/** The one request text this plugin still words itself: the notice for saved request settings
 *  that failed validation. The "Request" section's texts and the deviation notices come from the
 *  kit connection (`createLlmConnection`, default language English). */
export function requestDroppedNotice(n: number): string {
  return `${n} saved request setting(s) were invalid and were reset to the profile.`;
}

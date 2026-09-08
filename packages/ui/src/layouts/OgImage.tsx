export interface OgTemplateParams {
  title: string;
  summary: string;
  date: string;
}

/** Escape the free-text slots at the template boundary (titles carry quotes, ampersands). */
const escapeHtml = (value: string): string =>
  value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

export const OgTemplates = {
  default: (params: OgTemplateParams) => `
    <div style="display: flex; flex-direction: column; width: 1200px; height: 630px; padding: 80px; background: white; color: black; font-family: 'Libre Caslon Condensed';">
      <div style="display: flex; flex-direction: column; flex: 1;">
        <h1 style="font-size: 72px; margin: 0 0 20px 0; line-height: 1.1;">${escapeHtml(params.title)}</h1>
        <p style="font-size: 32px; margin: 0; opacity: 0.9; line-height: 1.4;">${escapeHtml(params.summary)}</p>
      </div>
      <div style="display: flex; align-items: center; font-size: 24px;">
        <span>Tom Hackshaw</span>
      </div>
    </div>
  `,
  minimal: (params: OgTemplateParams) => `
    <div style="display: flex; flex-direction: row; align-items: center; justify-content: center; gap: 30px; width: 1200px; height: 630px; background: #1a1a1a; color: white; font-family: system-ui, sans-serif;">
      <h1 style="font-size: 64px; margin: 0;">${escapeHtml(params.title)}</h1>
      <span style="font-size: 32px; opacity: 0.6;">|</span>
      <p style="font-size: 32px; margin: 0;">${escapeHtml(params.summary)}</p>
    </div>
  `,
  developer: (params: OgTemplateParams) => `
    <div style="display: flex; flex-direction: column; justify-content: center; width: 1200px; height: 630px; padding: 60px; background: #0d1117; color: #58a6ff; font-family: monospace;">
      <div style="font-size: 56px; margin-bottom: 20px; color: white;">${escapeHtml(params.title)}</div>
      <div style="font-size: 32px; color: #8b949e;">${escapeHtml(params.summary)}</div>
    </div>
  `,
  sophie: (params: OgTemplateParams) => {
    const words = params.summary.split(" ").filter((word) => word !== "");
    const last = words.pop() ?? "";
    const rest = words.join(" ");
    // No pill for empty last words, no leading space for single-word
    // summaries — otherwise an empty bordered pill (or stray nbsp) renders.
    const restHtml = rest === "" ? "" : `<span>${escapeHtml(rest)}&nbsp;</span>`;
    const pillHtml =
      last === ""
        ? ""
        : `<span style="border: 3px solid #1c1c1c; border-radius: 9999px; padding: 2px 20px;">${escapeHtml(last)}</span>`;
    return `
    <div style="display: flex; flex-direction: column; width: 1200px; height: 630px; padding: 80px 100px; background: #ece8df; color: #1c1c1c; font-family: Solway, Georgia, serif;">
      <div style="display: flex; flex-direction: row;">
        <div style="font-size: 44px; line-height: 1.2; max-width: 55%; overflow: hidden; text-overflow: ellipsis;">${escapeHtml(params.title)}</div>
        <div style="display: flex; flex: 1;"></div>
        <div style="display: flex; flex-direction: row; align-items: center; font-size: 44px; line-height: 1.2; max-width: 55%; overflow: hidden; text-overflow: ellipsis;">${restHtml}${pillHtml}</div>
      </div>
      <div style="display: flex; flex: 1;"></div>
      <div style="display: flex; flex-direction: row;">
        <div style="font-size: 44px; line-height: 1.2;">${escapeHtml(params.date)}</div>
        <div style="display: flex; flex: 1;"></div>
        <div style="font-size: 44px; line-height: 1.2;">Sophie ©</div>
      </div>
    </div>
  `;
  },
};

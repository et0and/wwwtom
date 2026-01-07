export interface OgTemplateParams {
  title: string;
  summary: string;
}

export const OgTemplates = {
  default: (params: OgTemplateParams) => `
    <div style="display: flex; flex-direction: column; width: 1200px; height: 630px; padding: 80px; background: white; color: black; font-family: 'Libre Caslon Condensed';">
      <div style="display: flex; flex-direction: column; flex: 1;">
        <h1 style="font-size: 72px; margin: 0 0 20px 0; line-height: 1.1;">${params.title}</h1>
        <p style="font-size: 32px; margin: 0; opacity: 0.9; line-height: 1.4;">${params.summary}</p>
      </div>
      <div style="display: flex; align-items: center; font-size: 24px;">
        <span>Tom Hackshaw</span>
      </div>
    </div>
  `,
  minimal: (params: OgTemplateParams) => `
    <div style="display: flex; align-items: center; justify-content: center; width: 1200px; height: 630px; background: #1a1a1a; color: white; font-family: system-ui, sans-serif;">
      <h1 style="font-size: 64px; margin: 0;">${params.title}</h1>
      <p style="font-size: 32px; margin: 0;">${params.summary}</p>
    </div>
  `,
  developer: (params: OgTemplateParams) => `
    <div style="display: flex; flex-direction: column; width: 1200px; height: 630px; padding: 60px; background: #0d1117; color: #58a6ff; font-family: monospace;">
      <div style="font-size: 28px; margin-bottom: 30px; color: #8b949e;">// Developer Profile</div>
      <div style="font-size: 56px; margin-bottom: 20px; color: white;">${params.title}</div>
      <div style="font-size: 32px; color: #8b949e;">${params.summary}</div>
    </div>
  `,
};

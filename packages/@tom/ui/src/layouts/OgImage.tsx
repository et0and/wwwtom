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
    </div>
  `,
  developer: (params: OgTemplateParams) => `
    <div style="display: flex; flex-direction: column; width: 1200px; height: 630px; padding: 60px; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; font-family: 'Fira Code', monospace;">
      <div style="font-size: 24px; opacity: 0.9; margin-bottom: 20px;">const developer = {</div>
      <div style="padding-left: 40px;">
        <div style="font-size: 48px; margin-bottom: 10px;">name: "${params.title}",</div>
        <div style="font-size: 28px;">role: "${params.summary}"</div>
      </div>
      <div style="font-size: 24px; opacity: 0.9; margin-top: 20px;">};</div>
    </div>
  `,
};

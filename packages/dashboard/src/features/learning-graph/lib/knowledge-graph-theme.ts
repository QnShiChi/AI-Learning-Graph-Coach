export interface KnowledgeGraphThemeTokens {
  canvasBg: string;
  canvasGlow: string;
  dotColor: string;
  legendBg: string;
  panelBg: string;
  railBg: string;
  textPrimary: string;
  textMuted: string;
  textOnDarkSurface: string;
  edgePrerequisite: string;
  edgeMuted: string;
  edgePath: string;
  currentGlow: string;
  nodeBorder: string;
  nodeSurface: string;
}

export function getKnowledgeGraphTheme(resolvedTheme: 'light' | 'dark'): KnowledgeGraphThemeTokens {
  if (resolvedTheme === 'light') {
    return {
      canvasBg: 'linear-gradient(180deg, rgba(248,250,252,0.98), rgba(241,245,249,0.98))',
      canvasGlow: 'radial-gradient(circle at top, rgba(14,165,233,0.10), transparent 58%)',
      dotColor: 'rgba(71,85,105,0.18)',
      legendBg: 'rgba(255,255,255,0.84)',
      panelBg: 'rgba(255,255,255,0.92)',
      railBg: 'rgba(255,255,255,0.88)',
      textPrimary: 'rgb(15,23,42)',
      textMuted: 'rgb(71,85,105)',
      textOnDarkSurface: 'rgb(241,245,249)',
      edgePrerequisite: 'rgba(71,85,105,0.34)',
      edgeMuted: 'rgba(148,163,184,0.22)',
      edgePath: 'rgba(2,132,199,0.88)',
      currentGlow: '0 0 36px rgba(14,165,233,0.16)',
      nodeBorder: 'rgba(148,163,184,0.28)',
      nodeSurface: 'rgba(255,255,255,0.88)',
    };
  }

  return {
    canvasBg: 'linear-gradient(180deg, rgba(15,23,42,0.98), rgba(2,6,23,0.98))',
    canvasGlow: 'radial-gradient(circle at top, rgba(56,189,248,0.14), transparent 58%)',
    dotColor: 'rgba(148,163,184,0.22)',
    legendBg: 'rgba(2,6,23,0.70)',
    panelBg: 'rgba(15,23,42,0.92)',
    railBg: 'rgba(15,23,42,0.86)',
    textPrimary: 'rgb(241,245,249)',
    textMuted: 'rgb(148,163,184)',
    textOnDarkSurface: 'rgb(241,245,249)',
    edgePrerequisite: 'rgba(148,163,184,0.42)',
    edgeMuted: 'rgba(148,163,184,0.18)',
    edgePath: 'rgba(103,232,249,0.95)',
    currentGlow: '0 0 48px rgba(56,189,248,0.18)',
    nodeBorder: 'rgba(148,163,184,0.2)',
    nodeSurface: 'rgba(15,23,42,0.88)',
  };
}

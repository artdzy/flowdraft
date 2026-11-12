import { useEffect } from 'react';
import { openProjects } from '../components/TopBar';
import { useEditor } from '../store/editor';
import { useUi } from '../store/ui';
import { importText, requestExport, requestSave } from './actions';
import { openDescribe } from './describe';
import { guideHref } from './guides';
import { isTyping, runOnce } from './keys';
import { onNativeEvent } from './platform';

/**
 * Menu bar commands of the iOS / Mac app (ios/Flowdraft/EditorCommands.swift). The zoom commands need the canvas
 * and are handled there (Canvas.tsx).
 */
const COMMANDS: Record<string, () => void> = {
  newFlow: () => useUi.setState({ newOpen: true }),
  describe: openDescribe,
  projects: openProjects,
  save: () => runOnce('save', requestSave),
  exportPng: () => requestExport('png'),
  exportSvg: () => requestExport('svg'),
  exportPdfA4: () => requestExport('pdfA4'),
  exportPdfA3: () => requestExport('pdfA3'),
  exportJson: () => requestExport('json'),
  aiTools: () => useUi.setState({ aiOpen: true }),
  guide: () => window.open(guideHref('what'), '_blank'),
  selectAll,
};

/** Edit > Select All: the text of the field being typed in, otherwise every part on the canvas. */
function selectAll() {
  const el = document.activeElement;
  if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement) el.select();
  else if (isTyping(el)) document.execCommand('selectAll');
  else useEditor.getState().selectAll();
}

export function useNativeCommands() {
  useEffect(
    () =>
      onNativeEvent((event) => {
        if (event.type === 'command') COMMANDS[event.name]?.();
        else if (event.type === 'importFile') importText(event.text, event.name);
      }),
    [],
  );
}

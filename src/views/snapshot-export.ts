import {snapshotDownload, type createBoardSnapshot} from '../application/board-snapshot.ts';

export function createSnapshotExport(container: HTMLElement, capture: () => ReturnType<typeof createBoardSnapshot>, notify: (message: string) => void) {
  const button = document.createElement('button'); button.className = 'secondary snapshot-export'; button.textContent = '匯出盤面 JSON';
  button.title = '匯出接線、元件狀態、電源及最近一次接線錯誤';
  button.onclick = () => {
    let url: string | undefined;
    const link = document.createElement('a');
    try {
      const file = snapshotDownload(capture());
      url = URL.createObjectURL(new Blob([file.content], {type: file.mimeType}));
      link.href = url; link.download = file.filename; link.hidden = true; document.body.append(link); link.click();
      notify('已匯出盤面 JSON，可保留或提供排查問題');
    } catch {notify('匯出失敗，請保留此頁並再試一次');}
    finally {link.remove(); if (url) {const savedUrl = url; setTimeout(() => URL.revokeObjectURL(savedUrl), 1000);}}
  };
  container.prepend(button); return button;
}

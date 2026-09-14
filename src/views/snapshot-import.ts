import {MAX_SNAPSHOT_BYTES} from '../application/snapshot-validation.ts';

export function createSnapshotImport(container: HTMLElement, apply: (source: string) => {wireCount: number}, notify: (message: string) => void) {
  const section = document.createElement('section'); section.className = 'snapshot-import';
  const button = document.createElement('button'); button.className = 'secondary'; button.textContent = '匯入盤面 JSON';
  const input = document.createElement('input'); input.type = 'file'; input.accept = '.json,application/json'; input.hidden = true;
  const status = document.createElement('p'); status.setAttribute('role', 'status'); status.setAttribute('aria-live', 'polite');
  status.textContent = '請先停止模擬。匯入會替換目前盤面，並保持未送電；按住中的按鈕會釋放。';
  let busy = false;
  button.onclick = () => {if (!busy) input.click();};
  input.onchange = async () => {
    const file = input.files?.[0]; if (!file || busy) return;
    busy = true; button.disabled = true; status.textContent = '正在讀取與檢查盤面…';
    try {
      if (file.size > MAX_SNAPSHOT_BYTES) throw new Error('JSON 檔案超過 10 MB');
      const source = await file.text();
      const result = apply(source);
      status.textContent = `已匯入 ${result.wireCount} 條接線；目前未送電，可繼續接線或送電模擬。`;
      notify('盤面已匯入');
    } catch (error) {
      status.textContent = `匯入失敗：${error instanceof Error ? error.message : '無法讀取檔案'}。原盤面已保留。`;
      notify('匯入失敗，請查看右側說明');
    } finally {input.value = ''; busy = false; button.disabled = false;}
  };
  section.append(button, input, status); container.prepend(section);
  return {button, input, status};
}

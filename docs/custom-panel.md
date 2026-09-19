# Custom panel builder / 自訂盤面

## Use

Stop simulation, then choose **Customize panel** in the header. The default 2.5D orthographic view avoids perspective scaling while retaining horizontal orbit and zoom. The component library uses two columns on desktop. Search by model, manufacturer or name, or filter by purpose.

Click a card for a 360° model viewer and the available catalog metadata. Drag a card onto the board, or choose **Place on panel** and click a location. While dragging, only the translucent model and placement feedback appear on the board; the browser's duplicate library-card thumbnail is hidden so it cannot obscure the drop position. The preview snaps to a 10 scene-unit grid: green means valid placement; red includes an explanation. Dimensions are scene units, not verified physical millimetres. Unverified electrical ratings are deliberately not invented.

Select a placed component to move, rotate 90°, duplicate, inspect or delete it. **R** rotates; **Escape** cancels placement; **Ctrl/Cmd Z** undoes; **Ctrl/Cmd Shift Z** redoes; **Ctrl/Cmd D** duplicates. Shortcuts leave text editing and native dialogs intact. On touch devices use the dialog's placement button followed by a tap on the board.

Baseplate and operation-panel mounts remain separate. Panel-mounted controls select the operation panel automatically and close it before placement. AP22 accessories attach to compatible S-P16 slots rather than floating independently. Moving/rotating an attachment moves its host group. Copying a host also copies its attached modules, but not its wires. Deleting an accessory alone leaves its host; deleting a host includes its accessories and asks for confirmation when necessary. Fixed equipment connections and the panel gateway are protected.

**Save JSON** and **Import** use the existing project format. **Finish layout** returns to wiring and simulation. Undo/redo is intentionally scoped to the current editing session: leaving the editor or importing an unrelated project clears it, so later undo cannot silently erase subsequent wiring work.

## Publication and failure handling

A placement preview does not mutate the live project. Validation uses actual visible model bounds and checks board limits, other components, ducts and operation-panel geometry in its open and closed positions. Applying a change rebuilds a separate runtime through `ProjectSession`, rerouting and validating the existing electrical endpoint connections before publication. Cancellation or failure leaves the original runtime intact and does not advance history. A successful placement check alone does not guarantee that wire routing will succeed.

The first version edits component placement using the already configured plate, rails and ducts. It does not add plate resizing, a new rail/duct drawing tool, hinge swept-volume physics, or new unqualified electrical device models. It is a teaching simulator, not physical-installation approval software.

## 中文操作摘要

先停止模擬，再按右上角「自訂盤面」。左側可搜尋、分類、拖出元件，或點擊卡片查看 360° 模型後選擇「放到盤面」。拖曳時不顯示重複的元件卡片，只保留盤面上的半透明模型與放置提示，避免遮住定位點。盤面每格 10 場景單位；綠色可放、紅色會說明越界或碰撞原因。

點選已放好的元件可移動、每次旋轉 90°、複製、查閱資料或刪除。R 旋轉、Esc 取消、Ctrl／⌘ Z 復原、Ctrl／⌘ Shift Z 重做。操作板元件會切換到相應安裝面；附件依相容插槽安裝。既有接線會在套用配置前重新驗證，失敗或取消不會破壞原盤面。

「儲存 JSON」保留自訂位置與接線；按「完成配置」回到原有配線／模擬流程。復原僅限當次建造模式，離開或匯入其他專案會清除歷史。此版不編輯底盤尺寸、DIN 軌或線槽；模型尺寸不是實測毫米，未核對額定電壓／電流不會自行填入。

## Verification

`npm test` includes `qa/editor-check.ts`: immutable commands, grid and rotation, mount compatibility, attachment copy/delete behavior, fixed-wire protection, actual geometry, failed publication/history, concurrency, keyboard ownership, orthographic projection, and a real wired-project move/undo through `ProjectSession`. The full existing electrical and routing suite remains enabled. `npm run build` validates and creates both the website and WIRE-R22 standalone HTML from the same source. Browser/WebGL visual acceptance remains owner-managed; Node geometry tests do not claim pixel-level verification.

`npm run test:browser:editor-drag` is an optional DOM-only Chromium regression (install Playwright Chromium, or set `CHROMIUM_EXECUTABLE`). It drives real native drags through the actual editor UI and checks the transparent drag bitmap, unchanged payload/copy behavior, placement feedback, drop/cancel, card click and cleanup. The renderer/viewer and publication host are fixtures; this does not claim WebGL pixels or routing acceptance.

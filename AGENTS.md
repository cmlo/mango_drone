# MangoDrone Rev A — execute hardware design

本分支是使用者明確授權的第一版打樣設計。以 docs/FC_RevA_Design.md、docs/POWER_RevA_Design.md 及 docs/IMPLEMENTATION_ADDENDUM.md 為實作基線；補充頁的修正優先。不要沿用舊 v0.7「每一步停止等審查」規則。

## 直接執行
- 連續完成兩套原生 KiCad 10 階層式原理圖、本地庫、封裝、元件擺位、走線、覆銅及打樣輸出。不要只提交摘要、TODO、空白 PCB 或含未佈線飛線的成品聲明。
- 未知馬達電流、實際球罩尺寸、既有 SDK commit 與供應鏈證明不是本版 CAD 開工阻塞；使用文件的工程預設，記錄 assumptions.md 後繼續。工程假設不等於實测值。
- 可以自行選定阻容的完整 MPN、採購包裝尾碼、同等電感／二极體／邏輯門替料，以及為可製造性調整布局。保留功能與介面；查原廠腳號及絕對額定值；每次替料同步改 BOM、symbol、footprint。
- 遇到真實電氣矛盾，修正並記錄而不是盲從本文；不要為通過檢查刪掉元件、設全部腳位為 passive、關掉規則或偽造結果。
- 不自動購料、付款、下單、飛行或公開私人專案。首版製造資料生成與實際下單是不同動作。

## 執行順序
1. 讀兩份設計及補充頁，執行 python3 scripts/build_design_data.py 產生 GPIO／介面／BOM 基線。
2. 使用原廠資料建立或核對本地庫，特別是 RP2354B EP、MOS drain EP、RM2 天線區與第二 Flash CS1。
3. 畫完整原理圖，解決真實 ERC，再完成兩板擺位與全部走線。
4. 執行 scripts/run_kicad_checks.py；保留 CLI 版本、命令、stdout/stderr、exit code 與原始 JSON。
5. 匯出各板 Gerber、PTH/NPTH 鑽孔、逐位號 BOM、CPL、裝配圖、STEP、原理圖 PDF 及製造 README。匯出腳本也提交。
6. 回寫狀態及變更，提交到本 PR 分支。若執行環境缺 KiCad，優先安裝／使用可用容器；如確實不能執行，留下實際已完成檔案與 NOT_RUN 原因，不得宣稱 CAD 已驗證。

## 路徑與完成條件
- hardware/FC/FC_RevA.kicad_pro、.kicad_sch、.kicad_pcb
- hardware/POWER/POWER_RevA.kicad_pro、.kicad_sch、.kicad_pcb
- 每板專案本地 symbol/footprint 庫及相對路徑，不依賴個人絕對路徑。
- reports/ 內真實 ERC/DRC；短路、缺封裝及未連線修正至零；其餘警告逐項解釋，不直接視為通過。
- manufacturing/FC、manufacturing/POWER 為完整可檢查打樣輸出。未做台架測試仍寫 NOT_TESTED，不等馬達曲線才產生 CAD。

除非是無法自行解析的授權或工具問題，不需要逐階段詢問使用者。首要交付是能開啟、完整連接且完成走線的原生設計檔。

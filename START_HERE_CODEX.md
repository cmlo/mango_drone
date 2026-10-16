# 直接開始 Rev A 原型板設計

使用者已要求：不要再停留於審查；完成兩片板的 KiCad 專案，先做第一輪打樣驗證。

請讀 AGENTS.md，再讀 docs/FC_RevA_Design.md、docs/POWER_RevA_Design.md、docs/IMPLEMENTATION_ADDENDUM.md。這些是實作指令，不是要求你再次提出一份設計建議。

交付順序是：完整原理圖 → PCB 擺位與全走線 → 真實 ERC/DRC 與一致性檢查 → 製造輸出。連續執行，不在各階段停下要求批准。未知馬達電流以量測與可調門檻處理，不能拿來阻止 KiCad 設計。

## 已定義的原型邊界
RP2354B、RM2、16MB CS1 Flash、BMI270/BMP280；FC50×60mm，POWER50×45mm，12mm柱；普通2S最高8.4V；4路單向有刷；每路獨立電流感測與名義12A故障關閉。3A/路是散熱設計目標，不是馬達規格或已測額定。

USB-C本版只有資料與插入偵測，下載時從J1供5V；不允許把USB VBUS直接短到動力5V。RM2既有成功經驗不代表此新板已驗證。未做飛行及採購合規聲明。

## 先執行
```
python3 scripts/build_design_data.py
python3 scripts/check_handoff.py
```

再建立兩個原生KiCad10專案。不要建立只有文字註解、外框或空白庫的檔案來充當成品。腳位與實際元件圖若有矛盾，以原廠為準修正並在CHANGELOG記錄。

## 狀態回報
在reports/implementation_status.json分別記錄：schematic、pcb_placement、pcb_routing、erc、drc、manufacturing_exports、bench_tests。狀態只能來自實際檔案與命令。設計資料包中的 reports/delivery_status.json 是交接時快照，不是未來CAD的完成證明。

# Rev A 實作補充與接線修正

版本：2026-10-17 / Rev A.1。此頁隨兩份設計書交付，對同名訊號的修正優先於原文。它把工程預設轉成可執行接線，不新增逐項等候使用者批准的关卡。

## A1｜PGOOD與FAULT不可短成同一語意

POWER文件第05節所述「buck PGOOD直接匯接FAULT_LOCALn」改為隔離後匯接。RT6217A pin1定名BUCK_PGOODn（此n表示開汲極／故障低，健康時由上拉為高），以10k上拉3V3_PWR。

新增SN74LVC1G07DBVR一顆：pin1 NC、pin2 A=BUCK_PGOODn、pin3 GND、pin4 Y=FAULT_LOCALn、pin5 VCC=3V3_PWR，就近100nF。此非反相開汲極緩衝器只允許PGOOD故障拉低總故障，不讓過流／USB故障回拉buck PGOOD。 [R28]

原SN74LVC2G07兩路仍分別將FAULT_LOCALn和BUCK_PGOODn送往FC的MOTOR_FAULTn與PWR_PGOOD；FC各10k上拉。不要在FC與POWER之間直接並聯3.3V供電。TPS3808、TPS3431與四路比較器仍可wired-OR到FAULT_LOCALn。

## A2｜補齊保護元件實體腳

TPS3808GxxDBVR：1RESETn、2GND、3MRn、4CT、5SENSE、6VDD。CT開路是原廠固定20ms名義釋放延遲；MRn上拉10k。FC G33的SENSE=3V3_DIG；POWER G33的SENSE=3V3_PWR；POWER G50的SENSE=5V、VDD=3V3_PWR。 [R17]

TLV1704 TSSOP14：1OUT1、2OUT2、3V+、4IN1-、5IN1+、6IN2-、7IN2+、8IN3-、9IN3+、10IN4-、11IN4+、12GND/V-、13OUT4、14OUT3。四路IN+接VTRIP，IN-接對應電流濾波值；輸出1/2/14/13匯接FAULT_LOCALn。建立符號時再以原廠pin表對照，不按通道順序猜焊盤號。 [R13]

REF3325AIDBZR：1IN、2OUT、3GND，採R14之DBZ圖，不借用其他基準芯片的SOT23符號腳序。

## A3｜保護能力的精確名稱

本版12A是名義「過流偵測後鎖存關閉」門檻，不是12A恆流調節器，也不保证任何短路條件下瞬時電流不超過12A。比較器、濾波、放大器恢復及driver關閉延遲需合併檢查SOA。先用限流電源／低能量治具量測，不以電池硬短路驗證。

若量測比較器支路，拆下該路1k串聯電阻，從比較器側測試點注入，避免外部電壓源與INA180輸出互相驅動。測試後復原1k並重驗零點。所有脈衝／延遲結果先留NOT_TESTED。

## A4｜板間線材與組裝件

三條GH線束全為1對1：J1=SM04B-GHS-TB(LF)(SN)、J2=SM12B-GHS-TB(LF)(SN)、J3=SM08B-GHS-TB(LF)(SN)。對應線殼GHR-04V-S、GHR-12V-S、GHR-08V-S，壓接端子SSHL-002T-P0.2。短線建議AWG26；雙5V與雙GND接點並用仍需實测壓降與不均流，不能宣稱任意雙倍額定。 [R21]

FC其他GH接口按相同系列對應pin數。J10/J11採2.54mm直排針；電池及馬達維持大銅焊盤與穿孔束線固定，不用GH承擔馬達電流。

A面貼片為初始裝配方向；3D驗證需要使用真實高度，特別是POWER220µF電容。四孔座標及RF矩形是可調工程預設。RM2 Fig6部分頁面影像擷取失敗，因此本包不宣稱已完成該新板的RF圖形審查；Codex直接取得R03圖6，核對14.5×16.5mm本體和35.5×18.5mm禁金屬區後調整座標，這是布局工作，不用停下等使用者。

## A5｜資料與生產BOM區分

scripts/build_design_data.py從已提交的兩份設計書生成data/、board_pins.h及NOT_TESTED表；不生成空白KiCad成品。data/bom_*.csv為工程選型／數量基線。Codex需把每一顆阻容、上拉、去耦、連接器、測試點落在完整原理圖，再匯出逐位號且MPN完整的製造BOM。

本包來源索引標示查閱範圍；未將全部資料表逐頁驗證，亦未宣稱所有MPN已有現貨。一般庫存或封裝尾碼问题可自行等效選型並記錄。兩份文件中Rxx是來源編號，E是工程假設，U01是既有使用者規格；三者不可互換。

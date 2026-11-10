# MangoDrone 動力板設計文件

## 動力板完整設計書｜Rev A

專案：MangoDrone 四路2S／1020有刷動力板。文件日期：2026-10-17。目標：提供足夠明確的元件與接線，讓Codex直接製作原生KiCad10並產出首批打樣檔。

本版採四路單向低側N-MOSFET、5V閘極驅動、四路電流量測、硬體過流鎖存與心跳停機。保留原本飛控／動力分板；不複製未取得原理圖的GT2功率電路。

1020實際料號、額定與堵轉電流仍未知，但不阻止電路及PCB實作。3A/路是散熱設計目標；12A/路是比較器名義故障門檻；兩者都不是馬達原廠規格或已實測板卡額定。

| 項目 | Rev A決策 |
| --- | --- |
| 供電 | 一般2S LiPo；操作6.4–8.4V；不含2S LiHV8.7V版本 |
| 動力 | 4×1020兩線式有刷；單方向PWM，首版25kHz |
| 尺寸 | 50×45mm；4層1.2mm；外層2oz／內層1oz |
| 功率級 | 4×CSD17577Q3A＋4×STPS5L60S＋2×TC4427A |
| 量測 | 4×10mΩ＋4×INA180A1；每路ADC獨立 |
| 保護 | 名義12A門檻、硬體fault latch、約62.74ms看門狗 |
| 電子供電 | RT6217A約5.023V；只供FC／電子系統，不供馬達 |

## 01｜原理圖分工與輸入保護

原理圖分頁：00_TOP、01_INPUT_5V、02_MOTOR_CH1..CH4、03_CURRENT_TRIP、04_ARM_WATCHDOG、05_FC_LINK。每路馬達以一致層次頁重用，元件位號與對應M1..M4不可交換。

BAT+→外部測試線束15A保險絲→VBAT_IN→反接保護N-MOS→VBAT_PROT。LM74700QDBVRQ1：pin6 ANODE接VBAT_IN，pin4 CATHODE接VBAT_PROT，pin5 GATE接Q1，pin3 EN接ANODE，pin2GND；pin1VCAP經100nF接ANODE，不是接地。Q1=CSD18540Q5B，source在輸入、drain在輸出。 [R18,R19]

LM74700與這顆FET是反接／理想二極體功能，不是能切斷正向體二極體電流的總電源安全開關。若馬達FET已D-S短路，ARM關閉不能保證停轉；初版測試必須有可觸及的實體斷電線束。

VBAT_PROT近入口放SMBJ10A（陰極接正、陽極接地）、220µF/25V混合電解及2×22µF/25V陶瓷。TVS不是電池過充保護。BAT採大焊盤＋拉力固定孔，電池不走GH小接头。

| 節點 | 設計／測試要求 |
| --- | --- |
| VBAT_PROT | 正常最高8.4V；入口波形目標峰值<20V |
| BAT線材 | 短AWG18；供電極性絲印至少兩處；測試夾具具快速斷電 |
| 220µF電容 | 初選EEH-ZC1E221P；約10.2mm高，放動力板後側；12mm柱且其上FC底面禁放元件 |
| 元件電壓邊界 | MOS30V、INA180共模26V、buck24V；依波形驗證，不只看標稱電池7.4V |

## 02｜5V降壓與本地3.3V

RT6217AHGJ8F：pin2VIN=VBAT_PROT、4GND、3SW→L1=4.7µH→5V、5BOOT經100nF回SW、6EN經100k接VBAT_PROT、7SS用3.9nF到GND、8FB接分壓、1PGOOD開汲極。EN預留測試點與下拉關閉治具；不留浮接。 [R08]

FB上臂107k、下臂20k，VOUT=0.791×(1+107/20)=5.02285V；上臂並47pF Cff。BOOT串阻0Ω起步，預留0–20Ω。輸入2×22µF/25V＋100nF；輸出3×22µF/16V X7R 1210，須核對5V下有效總值≥44µF，不把66µF名義值當有效值。

本地邏輯電源TLV75533PDBVR從5V產生3V3_PWR，EN接5V，IN/OUT各1µF，IC附近100nF。所有比較器、看門狗、邏輯門／運放各100nF；閘極驅動用5V，不使用FC的3.3V作功率板電源。 [R20]

PGOOD本地以10k上拉3V3_PWR；TPS3808G33監看3.3V，TPS3808G50以3.3V供電、SENSE監看5V，兩者RESETn與故障線匯接。G50名義4.65V門檻用於避免5V驅動器在低於4.5V區域工作。CT均開路，MRn各10k上拉。 [R17]

| 負載 | 5V預算／要求 |
| --- | --- |
| 飛控＋外接功能 | ≤1.2A設計預算 |
| 本地driver／logic | 初留150mA預算，實測峰值 |
| J1到FC | 雙5V／雙GND接點；正常總電流目標≤1.2A；端子壓降與溫升實測 |
| 5V降壓IC 3A | 是器件能力範圍，不是本板已通過的3A額定，更不供四顆馬達 |

## 03｜四路馬達驅動：可直接畫圖的接線

每路路徑：VBAT_PROT→RSx(10mΩ)→Mx_PLUS→馬達→Mx_MINUS→Qx drain→Qx source→GND。Qx=CSD17577Q3A；pin1/2/3=source、4=gate、5/6/7/8與EP9=drain。EP不可錯接GND！ [R10]

每路續流D=STPS5L60S（SMC）：陽極接Mx_MINUS，陰極接VBAT_PROT、位於分流電阻之前。如此關斷續流也流過RSx，可量到繞組電流；若陰極改接Mx_PLUS，PWM OFF時分流器被繞過，量測意義就不同。 [R11,E]

兩顆TC4427AEOA以5V供電：pin6VDD、3GND，pin2INA→pin7OUTA，pin4INB→pin5OUTB，pin1/8NC。OUT到gate各22Ω，gate-source各10k。每顆driver近端1µF＋100nF；控制輸入各47k下拉。GATED_PWM不是原始PWM，必須通過ARM硬體門。 [R09]

初版PWM25kHz，可由韌體改12/20/25/32kHz；不能用未測頻率當1020標準。馬達端預留10nF抑制電容為DNP，Drain-source的22Ω＋1nF串聯snubber也DNP，先看波形再裝，不能盲目增加大电容。

| 部件 | 每路預設值 | 用途 |
| --- | --- | --- |
| MOSFET | CSD17577Q3A，30V | 5V閘極驅動；獨立封裝便於散熱／重工 |
| Flyback | STPS5L60S，60V/5A器件 | 陰極回到RS之前母線 |
| RS | 10mΩ、1%、3W、2512 | Kelvin取樣 |
| RG / RGS | 22Ω /10k | 抑制振鈴／上電關閉 |
| 馬達接點 | 兩個≥3×4mm銅焊盤，短AWG22 | 不把小訊號接頭額定當馬達電流額定 |

## 04｜四路電流放大與硬體門檻

INA180A1IDBVR每路一顆，A1固定增益20：pin3IN+從RS母線端Kelvin拉出；pin4IN-從馬達端Kelvin拉出；pin1OUT=Ix_RAW；pin2GND；pin5=3V3_PWR。每輸入串10Ω並預留差分1nF（初始DNP）；不要把單端大電容直接掛在一邊造成不對稱。 [R12]

Ix_RAW=I×0.010×20=0.2V/A。每路Raw分成兩條支路：一條送FC；另一條經1k＋1nF至TLV1704的IN-，IN+接2.4V門檻。輸出為open-collector，四路wired-OR到FAULT_LOCALn。比較器與放大器、濾波及閘極關閉總延遲需要实测；本版目標<100µs，不宣稱資料表已保證整機此值。 [R12,R13,E]

REF3325AIDBZR：pin1IN=3V3_PWR，2OUT=2.5V，3GND；輸入100nF、輸出1µF；2.5V→1.00k→VTRIP→24.0k→GND，VTRIP旁100nF。名義VTRIP=2.4V，因此硬體名義trip=12A。這是故障限制起點，不是12A持續工作要求。 [R14]

| 目標門檻 | 分壓上臂（下臂固定24k） | 用途 |
| --- | --- | --- |
| 約8A | 13.7k →約1.592V | 低能量試驗可更換 |
| 約10A | 6.04k →約1.997V | 中間量程試驗 |
| 12A預設 | 1.00k →2.400V | 樣板預設，仍需實測誤差與延遲 |

| 誤差／波形 | 實作要求 |
| --- | --- |
| 電流門檻誤差 | 合併shunt1%、放大器gain/offset、reference及分壓公差、溫度；12A不是精確硬界線 |
| PWM雜訊 | 過流不能因啟動而完全屏蔽；若誤觸，先改善Kelvin／回路，再調合理RC |
| 量測到FC | 四路各自輸出；不能用總電流ADC冒充已識別單顆堵轉 |

## 05｜解鎖鎖存、心跳與USB硬體停機

FAULT_LOCALn以10k上拉3V3_PWR；四路過流open-collector、TPS3431 WDO/ENOUT、兩顆TPS3808 RESETn、buck PGOOD、USB_KILLn均可將它拉低。這是異步清除網路，不經RP2354B程式。另有測試點供短接到GND驗證。

SN74LVC1G74DCUR：pin1CLK=ARM_BUF；2D=3.3V；3/Q不接；4GND；5Q=ARM_LATCH；6/CLR=FAULT_LOCALn；7/PRE=3.3V；8VCC=3.3V。RUN=ARM_LATCH AND ARM_BUF；四路GATED_PWMx=RUN AND PWMx。兩顆SN74LVC08A提供所需AND門，未用輸入接GND，未用輸出NC。 [R16]

ARM／HEARTBEAT先經SN74LVC2G17（3V3_PWR供電，Ioff特性）進本地邏輯；兩輸入各47k下拉。PWM由具Ioff的LVC08輸入接收，亦各47k下拉。FAULT、PGOOD各用SN74LVC2G07開汲極輸出至FC；只在FC端上拉，以免跨板3.3V互相反供。

| 情境 | 硬體結果 |
| --- | --- |
| 未上電／MCU重置／ARM線拔掉 | ARM=0，RUN=0，gate被10k拉低 |
| 故障發生 | /CLR立即清Q，四路關閉 |
| 故障消失但ARM仍1 | Q仍0，不自動恢復油門 |
| 重新解鎖 | 需ARM先低，再於FAULT健康時產生新上升緣 |
| USB插入 | FC獨立FET拉USB_KILLn低，即使程式卡死仍停機 |
| MOSFET D-S損壞短路 | 不能靠關gate保證停轉；外部物理斷電介入 |

## 06｜看門狗接線與韌體交約

TPS3431SDRBR：pin1VDD=3.3V、4GND、EP接GND；pin2CWD=100pF C0G±5%到GND；pin3EN與pin5SET1接3.3V，不能接地；pin6WDI=HB_BUF；pin7WDO與pin8ENOUT接FAULT_LOCALn。 [R15]

依原廠公式，tWD(ms)=77.4×CWD(nF)+55，因此100pF名義62.74ms。看門狗有效事件是WDI下降沿；健康控制迴圈每10ms送一次脈衝。停止心跳後目標≤75ms關門，須測涵蓋電容與IC誤差。 [R15,E]

心跳只在感測器資料新鮮、控制迴圈正常、命令合法且未發生本地重大故障時更新。不准交給不受CPU健康控制的PIO、DMA或永久PWM自動續跳，否則無法偵測主程式卡死。

| 韌體初始規則（E） | 預設 |
| --- | --- |
| 上電 | 所有PWM=0，ARM=0，等待PGOOD／感測器與ADC自檢 |
| 心跳 | 10ms一個下降沿，先讓硬體故障網路恢復健康 |
| 解鎖 | USB未接、接收命令有效、低油門持續、姿態檢查通過，才新ARM上升緣 |
| 軟體試驗上限 | bench_profile：占空比先≤20%；單路循序加載；5A超過20ms暫設停機 |
| 啟動處理 | 可設定≤20ms啟動判斷窗，但12A硬體嚴重過流保護始終有效 |
| 飛行設定 | 不可直接把bench_profile當飛行參數；依實際槳／推力測試重新設定 |
| 失聯／復位 | 停止更新心跳並拉低ARM；外部接收機failsafe亦在FC處理 |

## 07｜板間接頭：與飛控完全一致

J1 GH4：1/2=+5V_PWR，3/4=GND。GH接點只承擔電子負載，不承擔馬達或電池主電流。J2 GH12為控制，J3 GH8為類比；線束長≤80mm，按編號1對1。板端pin1方形／三角標記，組裝圖另畫插接方向。 [R21]

POWER_IDn在本板以0Ω接GND，FC以10k上拉識別有刷板已連接；不是類比板卡ID，也不是完整熱插拔識別協議。未來無刷板必須另定介面，不能直接以相同接頭宣稱相容。

| J2針 | 網路 |
| --- | --- |
| 1 | GND |
| 2 | MOTOR1_CMD |
| 3 | MOTOR2_CMD |
| 4 | MOTOR3_CMD |
| 5 | MOTOR4_CMD |
| 6 | GND |
| 7 | MOTOR_ARM_REQ |
| 8 | MOTOR_HEARTBEAT |
| 9 | USB_KILLn |
| 10 | MOTOR_FAULTn |
| 11 | PWR_PGOOD |
| 12 | POWER_IDn |

| J3針 | 網路 |
| --- | --- |
| 1 | GND |
| 2 | VBAT_MON_RAW |
| 3 | I1_RAW |
| 4 | I2_RAW |
| 5 | GND |
| 6 | I3_RAW |
| 7 | I4_RAW |
| 8 | GND |

## 08｜電流與損耗計算：給佈局的尺寸依據

散熱設計起點為每路3A、四路同時工作；不是已通過3A持續認證。馬達電流由實測決定，若超出此熱目標，先修改功率散熱／元件，不靠刪除保護強行放行。

CSD17577Q3A在VGS4.5V、25°C的RDS(on)最大6.4mΩ；保守初算以1.8倍高溫係數（E，不是原廠保證係數）得11.52mΩ。3A、D=0.5時Pcond≈0.052W；另加開關損耗。17nC最大Qg、5V、25kHz四路理想充放閘極功耗約8.5mW，但不包含driver靜態損耗。 [R10,E]

以3A平坦繞組電流與D=0.5近似：RS損耗=I²R=0.09W；續流二極體平均1.5A、RMS約2.121A，原廠模型P≈0.39×IF_AV+0.028×IF_RMS²，約0.711W/路。四路二極體合計約2.84W，是比MOS導通更值得處理的熱源。此為計算案例，不是已測溫升。 [R11,E]

| 設計量 | 初版目標／處理 |
| --- | --- |
| 總母線 | 以12A連續電池路徑熱設計起點；高側鋪銅，不用單根細線 |
| 高電流銅 | 外層2oz，VBAT/GND局部至少5mm寬短通道起步；最終按長度／頸縮／溫升驗證 |
| 每路銅 | RS／馬達／FET每路至少2mm寬短連接起步；焊盤頸縮需檢查 |
| 過孔 | 必要換層時每路至少6個0.3mm鑽孔並聯起步；不是宣稱固定安培/孔 |
| 二極體散熱 | 陰極回VBAT的大銅區散熱；FET漏極SW銅不盲目擴大以免EMI |
| 溫度試验起點 | 室溫短測逐步延長；器件表面80°C或異味／電源失穩即停；結溫另估算 |

## 09｜PCB擺位、回流與機械

Power外框50×45mm、R2角、4層1.2mm、外層2oz內層1oz。孔座與FC共用30.5mm方形四孔；12mm板間柱。220µF高電容配置於動力板後側；其上方FC底面保留無元件區，至少1mm實體淨距。所有元件以實際3D高度檢查，不假設板邊有不存在的側伸區。

四路功率角落配置，各路RS→馬達焊盤→FET→續流二極體緊湊形成回路。中央放比較器／基準與鎖存；5V buck靠BAT入口但與類比Kelvin線分開。對應M1前右、M2後右、M3後左、M4前左，以+Y為機頭；旋向由馬達安裝與槳決定，不能只靠編號推斷。

Layer2保持完整GND；馬達回流經功率低阻路徑回BAT-，不要走板間J1再回來。分板不等於隔離，禁止為了“隔離雜訊”隨意割裂訊號參考地。類比線從分流器兩端獨立Kelvin拉出，遠離gate／SW，不在高電流線中途取樣。

| 區域 | 佈局要求 |
| --- | --- |
| 電池入口 | 反接FET、TVS、bulk相鄰；BAT±焊盤間保留充分間距 |
| 續流 | D陰極在RS之前，D和FET放近；不可長線繞板回母線 |
| Gate | driver→22Ω→gate距離≤10mm目標，driver GND直接參考source局部地 |
| 保護線 | FAULT_LOCALn短、少支線，提供TP；不要加會明顯延遲短路動作的大電容 |
| RF避讓 | Power y≤45，遠離FC RM2 RF投影y≥51.5；電池線不跨前緣天線區 |
| 測試點 | BAT、5V、3V3、GATE1..4、DRAIN1..4、I1..4、VTRIP、WDI、FAULT、RUN |

## 10｜主要BOM與裝配選項

完整工程選型表見data/bom_power.csv；Codex需由完成的原理圖輸出逐位號製造BOM。R/C在各電路頁已指定初值，不能以“待確認”代替把它們畫入原理圖。所有IC各100nF去耦，所有DNP在BOM與裝配圖一致。

可調項：gate22Ω、CWD100pF、VTRIP上臂、snubber、馬達抑制電容、buck Cff／BOOT電阻。這些用標準封裝保留改值空間；預設裝配不依賴未選定的可調電位器。

非紅供應鏈／政府採購文件另作批次追溯，不能用品牌推定產地；本版電氣樣板不自動視為採購認證產品。庫存替料允許同規格且可追溯的元件，須同步核對pin map及footprint，不得只替換BOM文字。

| 料號 | 數量 | 用途 |
| --- | --- | --- |
| LM74700QDBVRQ1 | 1 | Reverse battery ideal diode controller |
| CSD18540Q5B | 1 | Reverse protection N-MOS; source battery input |
| RT6217AHGJ8F | 1 | 2S to 5.023V buck |
| TLV75533PDBVR | 1 | Local 3.3V power-board logic |
| TC4427AEOA | 2 | Dual noninverting 5V gate drivers |
| CSD17577Q3A | 4 | Independent motor low-side MOSFETs |
| STPS5L60S | 4 | 60V 5A flyback; cathode BEFORE shunt |
| WSLP2512R0100FEA | 4 | 10mohm 1% 3W Kelvin routed |
| INA180A1IDBVR | 4 | 20V/V motor-current monitors |
| TLV1704AIPWR | 1 | Quad hardware overcurrent comparator |
| REF3325AIDBZR | 1 | 2.5V reference; divider produces2.4V |
| TPS3431SDRBR | 1 | 100pF watchdog nominal62.74ms |
| SN74LVC1G74DCUR | 1 | Edge-arm, asynchronous fault latch |
| SN74LVC08APWR | 2 | PWM and ARM gate; unused inputs GND |
| SN74LVC2G17DCKR | 1 | ARM + heartbeat input isolation/Schmitt |
| SN74LVC2G07DCKR | 1 | Open-drain fault/PGOOD reports to FC |
| TPS3808G33DBVR | 1 | 3.3V supervisor, CT open |
| TPS3808G50DBVR | 1 | 5V supervisor at4.65V; supply3.3V |
| SRP5030TA-4R7M | 1 | 4.7uH 5V buck |

## 11｜第一輪台架驗證：先做出可量測樣板

建議5片PCB先裝2片。一片先只裝入口／5V／3.3V／保護，確認後裝CH1，再裝其餘通道；另一片作重現比較。先不用電池與螺旋槳，使用限流電源、電子負載／受控RL治具與示波器。

電源限流會改變馬達啟動結果，需記錄是否進入CC；不能把受電源限制的峰值叫做自然堵轉電流。硬體過流可先用隔離電壓源注入INA输出比較器支路驗證，再用受控負載確認真實延遲，不必先長時間卡死馬達。

| 測試 | 方法 | 完成目標 |
| --- | --- | --- |
| P-01電源 | 7.4V/100mA限流起步；無馬達 | 電源方向、5V/3.3V波形正常後按負載提高限流 |
| P-02gate | FC連接；先不接馬達 | ARM0、fault、USB插入均四路gate低 |
| P-03鎖存 | ARM高時拉FAULT低再釋放 | 不自動重啟；新ARM邊緣才可恢復 |
| P-04心跳 | 正常10ms下降沿後停止 | ≤75ms關閉目標，記錄實測；不得預填PASS |
| P-05過流 | 每路比較器支路注入慢掃／階躍 | 記錄trip電壓／延遲／清鎖；目標总延遲<100µs |
| P-06單路負載 | 受控阻性及RL負載，0.5→1→2→3A | 含25kHz續流波形、MOS/二極體/RS溫度 |
| P-07無槳馬達 | 逐顆低占空起步 | 方向、空載／啟動電流；觀察VDS尖峰 |
| P-08四路同步 | 循序與同步加速比較 | VBAT、5V、FC3.3V最低值；無飛控重置 |
| P-09帶槳 | 防護治具、遙控急停與防飛散 | 推力／電流／溫度曲線；之後才能訂飛行油門上限 |

## 12｜Codex交付標準與不再停等規則

直接把本設計落成KiCad10，不以新增審查文件代替原理圖與PCB。對於未知馬達電流、未提供球罩尺寸、未量產供應鏈證明，使用本版工程預設繼續實作；在assumptions.md追蹤，等待實測收斂，不逐項詢問使用者。

有確實的器件腳位或電氣矛盾時，Codex應查原廠資料、自行修正並記錄差異；如需替代料，選等效可製造方案。不能保留短路、未連線、未分配封裝卻把Gerber標成可生產，也不得建立空白.kicad_pcb冒充完成。

原型製造輸出與飛行放行分開：完成電路／佈局與必要CAD檢查即可產出打樣包；實際上機前另完成台架測試。未授權自動購料／下單。

| 必交輸出 | 內容 |
| --- | --- |
| 兩獨立專案 | hardware/FC/FC_RevA.*；hardware/POWER/POWER_RevA.* |
| 完整原生資料 | .kicad_pro／.kicad_sch／.kicad_pcb、子頁、局部symbols／footprints／3D檔與庫表 |
| 真實檢查 | KiCad版本、ERC/DRC命令、exit code、原始報告；短路／未連線為0，警告有逐項解釋 |
| PCB | 完成元件擺位、走線、覆銅、RF禁佈與孔位；不是只有外框與飛線 |
| 製造包 | Gerber＋PTH/NPTH鑽孔＋BOM/CPL＋裝配圖＋STEP＋stackup说明 |
| 交付狀態 | IMPLEMENTED、CAD_CHECKED、NOT_TESTED分開；未執行的項目標NOT_RUN |
| 馬達參數回填 | 馬達型號、螺旋槳、供電、工作／啟動電流、推力與溫升，留作首輪實測 |

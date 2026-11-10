# MangoDrone 飛控板設計文件

## 飛控板完整設計書｜Rev A

專案：MangoDrone 教育／足球無人機。文件日期：2026-10-17。目標：直接交付 Codex 完成原生 KiCad 10 設計，製作第一輪工程樣板。

本版不再等待 1020 馬達供應商提供完整電流曲線；以明確的板級目標、預設元件與量測介面推進。此文件是可執行的電路設計輸入，並非已繞線、已通過 ERC/DRC 或已實測的成品證明。

設計方式：飛控與動力分板；電池先進動力板，5V 經專用線束到飛控。兩片板分別形成獨立 KiCad 專案；跨板接線以同版介面表為唯一依據。

首版取捨：保留 RP2354B、RM2、外接16MB資料Flash、BMI270、BMP280、定位模組與接收機介面。USB-C 僅供資料與插入偵測；燒錄／除錯時另從 J1 供5V，避免把 USB 電源切換問題變成首版阻塞。

| 項目 | Rev A 明確決策 |
| --- | --- |
| 主控／無線 | RP2354B；Raspberry Pi RM2；pico-sdk C/C++ |
| Flash | 內建2MB用韌體；外16MB用程式／Log，CS1=GPIO0 |
| 尺寸／堆疊 | FC 50×60mm、4層、1.0mm；孔距30.5mm |
| 上電預設 | 所有馬達命令、ARM、心跳均為低；初始化完成後才允許解鎖 |
| 交付狀態 | 設計輸入已定義；CAD與實測結果由執行者如實填寫 |

## 01｜功能界線與原理圖分頁

使用者既有 RP2350B＋RM2 的 Wi-Fi／BLE 實機經驗是參考基礎，不代表本次 RP2354B、電源及堆疊已被驗證。GT2／VDS200 只提供2S＋1020的產品定位，不據此宣稱其功率電路或馬達電流。 [U01,R26,R27]

Codex 應連續完成下列原理圖頁與PCB，不需每頁另等使用者審查。主控腳號、電源極性與元件封裝核對是實作的一部分；一般缺料可依等效規則替換並記錄。

| 頁名 | 應完成內容 |
| --- | --- |
| 00_TOP | 系統圖、三條板間線束、外接埠及Net Class |
| 01_POWER | J1輸入、TPS62132、感測器／RF分支、ADC隔離 |
| 02_MCU | RP2354B全部供電腳、核心buck、晶振、RUN、SWD、USB |
| 03_MEMORY_RF | 16MB Flash CS1、RM2三線PIO與供電／禁佈區 |
| 04_SENSORS | BMI270 SPI0、BMP280 I2C0、外接ToF與光流 |
| 05_IO | UART接收機、RGB、蜂鳴器、狀態燈、服務鍵 |
| 06_POWER_LINK | PWM/ARM/HB、FAULT/PGOOD、VBAT及4路電流 |

| 不在Rev A範圍 | 處理方式 |
| --- | --- |
| PSRAM、三相無刷ESC、馬達反轉 | 本版不裝、不用佔位芯片冒充完成 |
| 量產／競賽／非紅合格 | 保留追溯欄，不以工程打樣自動宣稱合格 |
| 任意第三方感測器插即用 | 本板提供明確自訂接頭；模組以轉接線配接 |

## 02｜5V輸入與3.3V電源

J1 pin1、2=+5V_PWR，pin3、4=GND。禁止接2S電池到J1。飛控單板測試時拔開動力板線束，從同一J1接限流5V；不另設會被誤並聯的供電插座。

TPS62132RGTR 固定3.3V：SW1/2/3接L2=2.2µH；VOS14在輸出電容正端Kelvin取樣；FB5接AGND；EN13接5V；FSW7=GND，DEF8=GND；SS9接3.3nF到GND。AVIN10、PVIN11/12接5V；PGND15/16、AGND6及EP接同一GND。 [R04]

輸入10µF/10V＋100nF；輸出2×22µF/10V X7R 1206，確認3.3V偏壓下總有效電容至少22µF。PG4以10k上拉3.3V，保留測試點。TPS3808G33監看3.3V，RESETn拉RUN；CT開路使用原廠固定延遲；MRn以10k上拉。 [R04,R17]

| 分支 | 初始配置／預算（E，非已測消耗） |
| --- | --- |
| 3V3_DIG | MCU含核心電源預留250mA；Flash50mA |
| 3V3_RF | 主3.3V经0Ω／0603選配磁珠；47µF＋1µF＋100nF；RM2預留500mA瞬態 |
| 3V3_SENS | 3.3V經2.2Ω＋10µF；BMI270/BMP280合計預留10mA |
| 3V3_EXT | 獨立0Ω分支＋10µF；外接感測器合計100mA |
| ADC_AVDD | 獨立10Ω＋1µF＋100nF至pin59 |
| 5V外部負載 | 接收機100mA；RGB250mA；蜂鳴器30mA |
| 整板5V目標 | 連線、RF与外接負載合計設計預算≤1.2A；實測確認 |

## 03｜RP2354B最小系統與核心供電

使用RP2354B原生80腳＋EP符號。不可僅將RP2350B符號改名字卻保留不相容的Flash連接。核心buck按Raspberry Pi新硬體指南實作：L1=AOTA-B201610S3R3-101-T，3.3µH，圓點朝1V1輸出；C6/C7/C9各4.7µF、0402；VREG_AVDD以33Ω從3.3V隔離。 [R01,R02]

VREG_LX63→L1→1V1_CORE；FB65在輸出電容正端取樣；VREG_VIN64接3.3V與近端4.7µF；PGND62接局部短回路再接完整GND。LX不得拉長或穿越IMU／RF區。VREG_AVDD61接33Ω後的4.7µF濾波點。

晶振Y1=ABM8-272-T3，XIN30直接接晶振一端；XOUT31經1k接另一端；晶振兩端各15pF到GND，晶體case pads接GND。RUN35上拉10k至3.3V，按鍵短接GND；BOOTSEL將QSPI_SS75經1k拉低。不得在運行中任意按BOOTSEL。 [R01]

| 實體腳 | 接線 |
| --- | --- |
| 5/15/24/29/41/50/60/76 | IOVDD→3V3_DIG，各近端100nF |
| 10/32/51 | DVDD→1V1_CORE；短低阻連接，各腳就近100nF並共用核心4.7µF |
| 59 | ADC_AVDD→濾波3.3V |
| 61/62/63/64/65 | VREG_AVDD / PGND / LX / VIN / FB，如上 |
| 68/69 | USB_OTP_VDD / QSPI_IOVDD→3V3_DIG，各100nF |
| 81 EP | GND；熱焊盤分窗鋼網、接地過孔 |
| 33/34/35 | SWCLK / SWDIO / RUN 至服務接口 |
| 66/67 | USB_DM / USB_DP，各經27Ω到USB ESD／接頭 |

## 04｜Flash與RM2接線

W25Q128JVSIQ是128Mbit＝16MB外部資料Flash：/CS pin1接GPIO0且10k上拉；與內建Flash共用QMI資料與時鐘，但不共用主片選QSPI_SS。開機韌體留在內部2MB；外部Flash讀寫要有QMI CS1初始化、區塊測試及掉電資料保護。 [R01,R02]

RM2使用使用者已驗證方向的三線PIO主機接法；主3.3V供Vin與VDDIO，不接5V。高GPIO的PIO base必須設為16；將PIO/DMA分配寫入韌體資源表，不能把GPIO37當硬體SPI預设引脚。 [R03]

| 外Flash腳 | 接至RP2354B |
| --- | --- |
| 1 /CS | GPIO0 / pad77；10k上拉 |
| 2 IO1 | QSPI_SD1 / pad74 |
| 3 IO2 | QSPI_SD2 / pad73 |
| 4 GND | GND |
| 5 IO0 | QSPI_SD0 / pad72 |
| 6 CLK | QSPI_SCLK / pad71，近MCU預留0/22Ω |
| 7 IO3 | QSPI_SD3 / pad70 |
| 8 VCC | 3.3V，100nF＋1µF |

| RM2腳 | 接線 |
| --- | --- |
| 12 WLON /13 BTON | GPIO36；47k下拉 |
| 5 DI | GPIO37直接支路 |
| 6 DO | 經470Ω回GPIO37共用節點 |
| 10 nIRQ | 經10k回GPIO37共用節點 |
| 9 CS /3 CLK | GPIO38 /GPIO39；CS上拉10k |
| 14 VDDIO /16 Vin | 3V3_RF |
| 1/4/7/11/15/21 | GND |
| 2/19/20；8/17/18 | 前三腳NC；後三腳本版不使用並標明NC |

## 05-1｜GPIO與實體腳完整分配

以下48路表是Rev A唯一GPIO基線。GPIO32～35使用PWM slice8/9；不是低腳位Pico的PWM表。GPIO41～44本版改為四路電流ADC，GPIO47改為5V量測；舊v0.7板ID／總電流類比配置不再沿用。 [R02,U01]

GPIO號與封裝pad不可混用；資料另提供JSON，Codex須核對所選RP2354B符號的逐腳映射並由同一表生成board_pins.h。

| GPIO | Pad | 網路 | 功能 | 上電要求 |
| --- | --- | --- | --- | --- |
| 0 | 77 | FLASH_CS1n | QMI_CS1 | HIGH_CS |
| 1 | 78 | PWR_PGOOD | SIO_IN | INPUT |
| 2 | 79 | SERVICE_KEYn | SIO_IN | INPUT_PULLUP |
| 3 | 80 | STATUS_LED | SIO_OUT | LOW |
| 4 | 1 | IMU_MISO | SPI0_RX | INPUT |
| 5 | 2 | IMU_CSn | SIO_CS | HIGH_CS |
| 6 | 3 | IMU_SCK | SPI0_SCK | LOW |
| 7 | 4 | IMU_MOSI | SPI0_TX | LOW |
| 8 | 6 | DBG_TX | UART1_TX | IDLE_HIGH |
| 9 | 7 | DBG_RX | UART1_RX | INPUT |
| 10 | 8 | TOF_SDA | I2C1_SDA | OPEN_DRAIN |
| 11 | 9 | TOF_SCL | I2C1_SCL | OPEN_DRAIN |
| 12 | 11 | FLOW_MISO | SPI1_RX | INPUT |
| 13 | 12 | FLOW_CSn | SIO_CS | HIGH_CS |
| 14 | 13 | FLOW_SCK | SPI1_SCK | LOW |
| 15 | 14 | FLOW_MOSI | SPI1_TX | LOW |

## 05-2｜GPIO與實體腳完整分配

以下48路表是Rev A唯一GPIO基線。GPIO32～35使用PWM slice8/9；不是低腳位Pico的PWM表。GPIO41～44本版改為四路電流ADC，GPIO47改為5V量測；舊v0.7板ID／總電流類比配置不再沿用。 [R02,U01]

GPIO號與封裝pad不可混用；資料另提供JSON，Codex須核對所選RP2354B符號的逐腳映射並由同一表生成board_pins.h。

| GPIO | Pad | 網路 | 功能 | 上電要求 |
| --- | --- | --- | --- | --- |
| 16 | 16 | RC_TX | UART0_TX | IDLE_HIGH |
| 17 | 17 | RC_RX | UART0_RX | INPUT |
| 18 | 18 | IMU_INT1 | SIO_IRQ | INPUT |
| 19 | 19 | FLOW_MOTIONn | SIO_IRQ | INPUT |
| 20 | 20 | BARO_SDA | I2C0_SDA | OPEN_DRAIN |
| 21 | 21 | BARO_SCL | I2C0_SCL | OPEN_DRAIN |
| 22 | 22 | TOF_XSHUT_OD | SIO_OUT | LOW_RELEASE |
| 23 | 23 | TOF_INTn | SIO_IRQ | INPUT |
| 24 | 25 | USB_PRESENTn | SIO_IN | INPUT |
| 25 | 26 | MOTOR_ARM_REQ | SIO_OUT | LOW |
| 26 | 27 | MOTOR_FAULTn | SIO_IRQ | INPUT |
| 27 | 28 | SPARE_GP27 | SIO_SPARE | INPUT |
| 28 | 36 | POWER_IDn | SIO_IN | INPUT_PULLUP |
| 29 | 37 | MOTOR_HEARTBEAT | SIO_OUT | LOW |
| 30 | 38 | SPARE_GP30 | SIO_SPARE | INPUT |
| 31 | 39 | SPARE_GP31 | SIO_SPARE | INPUT |

## 05-3｜GPIO與實體腳完整分配

以下48路表是Rev A唯一GPIO基線。GPIO32～35使用PWM slice8/9；不是低腳位Pico的PWM表。GPIO41～44本版改為四路電流ADC，GPIO47改為5V量測；舊v0.7板ID／總電流類比配置不再沿用。 [R02,U01]

GPIO號與封裝pad不可混用；資料另提供JSON，Codex須核對所選RP2354B符號的逐腳映射並由同一表生成board_pins.h。

| GPIO | Pad | 網路 | 功能 | 上電要求 |
| --- | --- | --- | --- | --- |
| 32 | 40 | MOTOR1_CMD | PWM8_A | LOW |
| 33 | 42 | MOTOR2_CMD | PWM8_B | LOW |
| 34 | 43 | MOTOR3_CMD | PWM9_A | LOW |
| 35 | 44 | MOTOR4_CMD | PWM9_B | LOW |
| 36 | 45 | WL_REG_ON | SIO_OUT | LOW |
| 37 | 46 | WL_DI_DO_IRQ | PIO | INPUT |
| 38 | 47 | WL_CS | SIO_OUT | HIGH_CS |
| 39 | 48 | WL_CLK | PIO | LOW |
| 40 | 49 | VBAT_ADC | ADC0 | ANALOG |
| 41 | 52 | I1_ADC | ADC1 | ANALOG |
| 42 | 53 | I2_ADC | ADC2 | ANALOG |
| 43 | 54 | I3_ADC | ADC3 | ANALOG |
| 44 | 55 | I4_ADC | ADC4 | ANALOG |
| 45 | 56 | TAIL_RGB_DATA | PIO | LOW |
| 46 | 57 | BUZZER_CMD | SIO_PWM | LOW |
| 47 | 58 | V5_ADC | ADC7 | ANALOG |

## 06｜姿態、氣壓及外接定位

BMI270以SPI0四線方式：pin1 SDO→GP4；12 CSB→GP5，10k上拉；13 SCx→GP6；14 SDx→GP7；4 INT1→GP18；5VDDIO、8VDD各100nF；6GNDIO、7GND接地。未使用的pin2 ASDx、pin3 ASCx、pin9 INT2、pin10 OCSB、pin11 OSDO均標NC；依原廠Table22及Primary 4-wire SPI / Secondary none圖，不把輔助腳任意接地。 [R05]

BMI270啟動必須載入官方設定檔並檢查狀態，不可只讀到chip ID就宣稱感測器初始化成功。原型先以SPI1MHz讀取，通過後提高；IMU採樣1kHz作韌體目標，不宣稱已達成。

BMP280：1/7GND，2CSB接VDDIO，3SDI→GP20 SDA，4SCK→GP21 SCL，5SDO接GND固定0x76，6VDDIO/8VDD各100nF。I2C0兩線各4.7k上拉3.3V。氣孔不得沾助焊劑或三防漆；預留開孔泡棉擋風，不封死。 [R06]

| 外接埠 | 本板固定針序／限制 |
| --- | --- |
| J6 光流 GH8 | 1=3V3_EXT，2=GND，3=SCK GP14，4=MOSI GP15，5=MISO GP12，6=CSn GP13，7=MOTIONn GP19，8=GND |
| J7 ToF GH6 | 1=3V3_EXT，2=GND，3=SDA GP10，4=SCL GP11，5=XSHUT_OD，6=INTn GP23 |
| ToF介面 | SDA/SCL各4.7k可DNP；XSHUT用2N7002拉低／釋放，不由3.3V推挽拉高；模組需3.3V主機相容I2C/INT |
| 模組規格界線 | 這是FC自訂接口，不是裸PMW3901／VL53L1X腳位。使用有穩壓／電平相容的完整模組與轉接線；腳序不相同不可直插 |

## 07｜USB、接收機、RGB與除錯

USB-C J4=USB4105-GF-A：兩個CC各5.1k到GND；A6/B6合併D+，A7/B7合併D-；MCU近端27Ω；USBLC6-2SC6靠接頭。USB shield近入口接GND，預留0Ω／1nF選配。USB_VBUS只連ESD參考與偵測，不接+5V_PWR，不設短接跳線。 [R01；接頭pin1方向由實作時原廠圖確認]

USB偵測用兩顆獨立2N7002：各gate經100k接VBUS、1M下拉；source接GND。Q1 drain接GP24並由FC3.3V上拉10k，得到USB_PRESENTn；Q2 drain專接跨板USB_KILLn，由動力板上拉，不與GP24節點合併。USB插入會直接清除動力鎖存，不靠韌體。

V1不提供USB單獨供電。燒錄方式是J1先供限流5V，再按BOOTSEL/RUN進USB下載；或由SWD燒錄。這是減少首版電源切換元件的明確取捨，而非未完成的USB電路。

| 接口 | 固定規格 |
| --- | --- |
| J5 UART接收機 GH4 | 1=5V，2=GND，3=FC_TX GP16，4=FC_RX GP17；3.3V邏輯；預留100Ω串阻，UART0 |
| J8 RGB GH3 | 1=5V，2=DATA，3=GND；GP45→SN74AHCT1G125→330Ω；/OE=GND；100k輸入下拉 |
| RGB負載 | 5V預算250mA，軟體初始亮度≤25%；實際燈珠版次／數量決定可用上限 |
| J9 蜂鳴器 GH2 | 1=5V，2=低側集電極；GP46→4.7k→MMBT3904；100k BE；外接主動式蜂鳴器≤30mA |
| J10 SWD 1×6 | 1=3V3_REF，2=GND，3=SWDIO，4=SWCLK，5=RUN，6=GND；REF不是供電輸入 |
| J11 UART debug 1×4 | 1=GND，2=GP8_TX，3=GP9_RX，4=3V3_REF；禁止5V TTL |
| 服務鍵／LED | GP2按鍵到GND、10k上拉；GP3→1k→LED→GND |

## 08｜跨板電源與控制線束

三條線束均為按接點編號1對1，不是按照片左右順序連接。JST GH有鎖扣；最大線長80mm。J1與外接接收機雖同為4pin但用途不同，必須絲印PWR／RC，並以不同線色及端點標籤防呆。禁止帶電插拔板間線。 [R21]

FC所有命令加100Ω靠近MCU；ARM與心跳在FC各47k下拉。PWM輸入在動力板另有47k下拉，控制門具powered-off保護。FAULT、PGOOD回報在動力板透過open-drain buffer，FC端10k上拉3V3_DIG；不直接把兩片板3.3V上拉電源並在一起。

| J1針 | 接線 |
| --- | --- |
| 1 | +5V_PWR |
| 2 | +5V_PWR |
| 3 | GND |
| 4 | GND |

| J2針 | 接線 | 方向 |
| --- | --- | --- |
| 1 | GND | 共地 |
| 2 | MOTOR1_CMD | FC→POWER |
| 3 | MOTOR2_CMD | FC→POWER |
| 4 | MOTOR3_CMD | FC→POWER |
| 5 | MOTOR4_CMD | FC→POWER |
| 6 | GND | 共地 |
| 7 | MOTOR_ARM_REQ | FC→POWER |
| 8 | MOTOR_HEARTBEAT | FC→POWER |
| 9 | USB_KILLn | FC→POWER |
| 10 | MOTOR_FAULTn | POWER→FC |
| 11 | PWR_PGOOD | POWER→FC |
| 12 | POWER_IDn | POWER→FC |

## 09｜四路電流ADC與掉電隔離

J3 pin2是VBAT_MON_RAW，最高8.4V；只進電阻分壓，不得直接接MCU、TMUX或感測器。FC端100k上臂、33k下臂，8.4V時約2.084V。I1～I4_RAW為0.2V/A，在FC各用10k上臂、20k下臂降為0.133333V/A；12A時ADC側1.6V。

所有六路類比量（VBAT、I1～I4、V5）均在分壓後經TMUX1511再到ADC，避免FC掉電時反供電。每通道選擇脚接3V3_DIG，掉電自動關；MCU端串1k、4.7nF到GND；未用通道S/D接GND、SEL接GND。V5另用100k/100k分壓。 [R07]

TMUX1511PWR腳：VDD14、GND7；(SEL,S,D)通道1=(1,2,3)、2=(4,5,6)、3=(10,9,8)、4=(13,12,11)。U7負責I1..I4；U8 ch1=VBAT、ch2=V5。ADC換通道後保留取得／穩定時間，初版重複取樣並丟棄首筆，以已知電壓校正增益。

| J3針 | 網路 | 範圍／說明 |
| --- | --- | --- |
| 1 | GND | GND |
| 2 | VBAT_MON_RAW | 0–8.4V，仅电阻分壓 |
| 3 | I1_RAW | 0–3.3V_PWR，未分壓 |
| 4 | I2_RAW | 0–3.3V_PWR，未分壓 |
| 5 | GND | GND |
| 6 | I3_RAW | 0–3.3V_PWR，未分壓 |
| 7 | I4_RAW | 0–3.3V_PWR，未分壓 |
| 8 | GND | GND |

| 換算 | 公式 |
| --- | --- |
| 電池 | VBAT=V_ADC×133/33 |
| 馬達電流 | Ix=V_ADC /0.133333，先扣零點偏移 |
| 5V電源 | V5=2×V_ADC |
| 電池總電流 | 不能直接將四路繞組電流相加當電池電流；PWM續流時不同。Σ(D×I)只能作近似估計 |

## 10｜PCB佈局與機構預設

尺寸為本版工程預設，不冒稱已吻合現有足球框。FC外框50×60mm、R2角、4層1.0mm、外內各1oz。坐標採頂視、左下(0,0)、+Y朝前；轉KiCad坐標時要顯式處理Y方向。安裝孔Ø3.2mm，中心(9.75,9.75)、(40.25,9.75)、(9.75,40.25)、(40.25,40.25)，孔周3.5mm禁銅；板間柱長12mm。

RM2本體矩形x=17.75..32.25，y=40..56.5；依原廠Fig6，RF禁金屬矩形x=7.25..42.75、y=51.5..70。PCB自身重疊區全層禁銅／走線／其他元件；外伸區也禁止電池、馬達線、金屬柱與碳纖維。下方動力板到y45結束，因此不進入RF禁佈投影。不要將35.5×18.5mm禁佈區錯當14.5×16.5mm模組外形。 [R03]

Layer1訊號／元件，Layer2完整GND，Layer3電源及慢速訊號，Layer4訊號／GND。保持USB、QSPI、SPI連續參考地；不要在IMU下方切地；RF禁佈區例外。

| 區域／網路 | 佈局起點 |
| --- | --- |
| BMI270 | 中心約(25,25)，遠離buck≥8mm，標註感測器軸與機頭方向 |
| BMP280 | 避開馬達風、電感及發熱；泡棉固定孔不壓氣孔 |
| 3.3V buck | 後側y<15，輸入與SW回路最短 |
| RP內部buck | 按原廠L1方向與近端布局，不拉到遠處 |
| USB | 後緣；差分90Ω由板廠疊層計算，不照抄其他板線寬 |
| QSPI／SPI | QSPI盡量<25mm；SCK預留串阻；避免長支線測試點 |
| 常規設計規則 | 線寬/間距≥0.15mm；via0.6/0.3mm；細pitch局部0.127mm可記錄使用 |

## 11｜BOM基線與替換規則

完整工程物料表見data/bom_fc.csv。此表定義主要元件、被動值與封裝要求；最終製造BOM必須由Codex完成原理圖標號後匯出，補齊每個電容／電阻的完整MPN、數量與DNP狀態，不得把本表C/R總項當成可下單BOM。

優先保留主控、RM2、BMI270、BMP280、CS1架構。一般阻容、接頭包裝尾碼與buck電感可在同等電氣／機械條件下替換；替换必须同步修改symbol、footprint、BOM與來源。不得為了解決採購而默默把RP2354B換回RP2350B或刪掉16MB。

政府採購與非紅供應鏈需求保留：紀錄manufacturer、晶圓／封測／組裝來源及批次證明。品牌國籍不等於成品產地；本版不宣稱已取得合格證明。這些追溯工作並行進行，不阻止先建立可驗證原型CAD。

| 主要元件 | 數量 | 作用 |
| --- | --- | --- |
| RP2354B | 1 | MCU with internal 2MB flash |
| RM2 | 1 | Wi-Fi/BLE; use official keepout |
| W25Q128JVSIQ | 1 | 16MB external data flash, CS1 GPIO0 |
| TPS62132RGTR | 1 | Fixed 3.3V buck; 3A device, budget is lower |
| BMI270 | 1 | Primary IMU, SPI0 |
| BMP280 | 1 | Barometer I2C0 0x76 |
| TMUX1511PWR | 2 | Powered-off isolation for six ADC paths |
| TPS3808G33DBVR | 1 | 3.07V reset supervisor, CT open |
| SN74AHCT1G125DBVR | 1 | 5V RGB buffer; verify Ioff ordering |
| USBLC6-2SC6 | 1 | USB data ESD; rail to sensed USB VBUS only |
| 2N7002P,215 | 3 | USB detector, USB motor kill, ToF open drain |
| MMBT3904LT1G | 1 | External buzzer low-side; 4.7k base, 100k BE |
| ABM8-272-T3 | 1 | 12MHz; 15pF each side, 1k XOUT series |
| AOTA-B201610S3R3-101-T | 1 | 3.3uH RP internal core buck, dot to 1V1 |
| SRP5030TA-2R2M | 1 | 2.2uH 3.3V buck, datasheet pad shape |

## 12｜飛控板打樣驗證與完成條件

第一批建議5片PCB、先裝2片：A板分段啟動，B板交叉比較；其餘留作重工或備板。這是製造數量建議，不是已下單。開機前不裝槳，不接馬達電源。

本版允許Codex直接產出打樣用Gerber／鑽孔／組裝BOM，但必須真實執行ERC/DRC。未繞線與錯腳須修好；資料表需複核的局部料件不能變成整案只交審查報告的理由。

| 次序 | 方法 | 通過目標／紀錄 |
| --- | --- | --- |
| FC-01 | 斷電查短路與方向 | 5V/3.3V/1V1無硬短；QFN/Flash/RM2方向正確 |
| FC-02 | 5.0V限流100mA起步，RF保持OFF | 先看電源波形；需要提高到300mA前先確認未短路；限流啟動失敗不直接判壞 |
| FC-03 | SWD連接與USB下載 | 能識別MCU、下載最小程式；USB需外部5V |
| FC-04 | Flash JEDEC／寫讀／CRC | 外部16MB單獨CS1；不覆寫內建韌體 |
| FC-05 | BMI270/BMP280 | 姿態軸向正確；IMU配置成功；baro地址0x76 |
| FC-06 | RM2 Wi-Fi＋BLE連線 | 逐步提高5V限流至1.2A；記錄峰值與3.3V最低值 |
| FC-07 | 已知電壓注入ADC | VBAT／四路電流／V5各做零點與兩點校正 |
| FC-08 | USB插入／拔線／復位 | ARM與PWM不誤啟動；USB硬體KILL有效 |
| FC-09 | 外接模組／UART／RGB | 只使用已核對轉接線；確認合計負載在預算內 |

| 交付檔 | 要求 |
| --- | --- |
| native KiCad | FC_RevA.kicad_pro / .kicad_sch / .kicad_pcb與所有子頁、局部庫 |
| reports | ERC/DRC原始輸出、版本、時間、剩餘警告與原因 |
| manufacturing | Gerber、PTH/NPTH drill、BOM、CPL、裝配圖、STEP、製造README |
| 實測表 | 未實測欄留NOT_TESTED，不可預填PASS |

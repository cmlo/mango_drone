# 原廠來源與證據索引

查閱日：2026-10-17。此索引供追溯及Codex取用，不表示每份PDF均逐頁審核，也不是新板ERC／DRC或實測報告。工程方案／計算以E標示；原廠功能以Rxx標示。

U01：使用者Library中的 RP2354B_KiCad10_Review_Spec_v0_7.md（2026-10-15），本次完整讀取；僅沿用已確認需求／舊板參考，新RevA取代其逐階段停等流程。

## R01｜Raspberry Pi — Hardware design with RP2350

https://pip.raspberrypi.com/documents/RP-008280-DS-hardware-design-with-rp2350.pdf

查閱／使用範圍：核心buck、晶振、第二Flash；既有基線＋本次相關章節讀取；PCB參考布局由Codex核對。

## R02｜Raspberry Pi — RP2350 complete datasheet

https://datasheets.raspberrypi.com/rp2350/rp2350-datasheet.pdf

查閱／使用範圍：GPIO/80QFN/QMI；本次可讀全文，但不代表1380頁均逐項審核。

## R03｜Raspberry Pi — Radio Module 2 datasheet

https://pip.raspberrypi.com/documents/RP-008943-DS-Radio%20Module%202%20Datasheet.pdf

查閱／使用範圍：pin1–21、供電與Fig6來源；頁圖擷取失敗，CAD時核圖；本體尺寸文本已確認。

## R04｜Texas Instruments — TPS62130/1/2 family

https://www.ti.com/lit/ds/symlink/tps62130.pdf

查閱／使用範圍：TPS62132固定3.3V、pin功能與應用值。

## R05｜Bosch — BMI270 datasheet

https://www.bosch-sensortec.com/media/boschsensortec/downloads/datasheets/bst-bmi270-ds000.pdf

查閱／使用範圍：4線SPI／未用介面／初始化；沿用v0.7官方pin表基線，CAD再核版次。

## R06｜Bosch — BMP280 datasheet

https://www.bosch-sensortec.com/media/boschsensortec/downloads/datasheets/bst-bmp280-ds001.pdf

查閱／使用範圍：I2C接法、0x76與去耦；沿用v0.7官方pin表基線。

## R07｜Texas Instruments — TMUX1511

https://www.ti.com/lit/ds/symlink/tmux1511.pdf

查閱／使用範圍：六路ADC掉電隔離方案與pin功能。

## R08｜Richtek — RT6217A/B

https://www.richtek.com/assets/product_file/RT6217A=RT6217B/DS6217AB-00.pdf

查閱／使用範圍：17頁原廠PDF；pin與5V設計表；本次成功取得文本。

## R09｜Microchip — TC4427A product documentation

https://www.microchip.com/en-us/product/TC4427A

查閱／使用範圍：原廠產品頁已確認；直接PDF抓取失敗；Codex由此取得TC4426A/27A/28A datasheet核對SOIC8。

## R10｜Texas Instruments — CSD17577Q3A

https://www.ti.com/lit/ds/symlink/csd17577q3a.pdf

查閱／使用範圍：MOS額定、RDS/Qg及封裝；本板熱能力仍待測。

## R11｜STMicroelectronics — STPS5L60

https://www.st.com/resource/en/datasheet/stps5l60.pdf

查閱／使用範圍：STPS5L60S、續流與損耗模型。

## R12｜Texas Instruments — INA180

https://www.ti.com/lit/ds/symlink/ina180.pdf

查閱／使用範圍：A1增益20、共模及輸入配置。

## R13｜Texas Instruments — TLV1704

https://www.ti.com/lit/ds/symlink/tlv1704.pdf

查閱／使用範圍：四路比較器pin功能、開集輸出；不是整板故障反應時間保證。

## R14｜Texas Instruments — REF33xx

https://www.ti.com/lit/ds/symlink/ref3312.pdf

查閱／使用範圍：REF3325在同族文件；DBZ pin1IN/2OUT/3GND。

## R15｜Texas Instruments — TPS3431

https://www.ti.com/lit/ds/symlink/tps3431.pdf

查閱／使用範圍：WDI下降沿、CWD公式、EN/WDO/ENOUT。

## R16｜Texas Instruments — SN74LVC1G74

https://www.ti.com/lit/ds/symlink/sn74lvc1g74.pdf

查閱／使用範圍：邊緣時脈與異步清除；封裝DCU腳序由Codex最後核對。

## R17｜Texas Instruments — TPS3808

https://www.ti.com/lit/ds/symlink/tps3808.pdf

查閱／使用範圍：G33/G50閾值、CT開路20ms、SOT23-6 pin表。

## R18｜Texas Instruments — LM74700-Q1

https://www.ti.com/lit/ds/symlink/lm74700-q1.pdf

查閱／使用範圍：反接／理想二極體控制；VCAP接ANODE電容。

## R19｜Texas Instruments — CSD18540Q5B

https://www.ti.com/lit/ds/symlink/csd18540q5b.pdf

查閱／使用範圍：外部反接FET；完整SOA／footprint於CAD選型工作確認。

## R20｜Texas Instruments — TLV755P

https://www.ti.com/product/TLV755P

查閱／使用範圍：固定3.3V版本TLV75533PDBVR；訂購型號／封裝於CAD核對。

## R21｜JST — GH connector

https://www.jst-mfg.com/product/pdf/eng/eGH.pdf

查閱／使用範圍：接頭、線殼、端子與機構圖；線束不可只按照片左右排序。

## R22｜KiCad 10 — Command-Line Interface

https://docs.kicad.org/10.0/en/cli/cli.html

查閱／使用範圍：實際ERC/DRC/原理圖一致性與覆銅CLI；本環境未安裝KiCad。

## R23｜OpenAI — AGENTS.md guidance

https://developers.openai.com/codex/agent-configuration/agents-md

查閱／使用範圍：repo執行規則；建立檔案不等於任務自動接受。

## R24｜OpenAI — Codex GitHub integration

https://developers.openai.com/codex/integrations/github

查閱／使用範圍：PR內@codex非review指令可啟動雲端工作；需該repo已配置。

## R25｜Winbond — W25Q128JV

https://www.winbond.com/hq/product/code-storage-flash-memory/serial-nor-flash/?__locale=en&partNo=W25Q128JV

查閱／使用範圍：完整MPN與原廠資料入口；本包不宣稱已查庫存或器件量產狀態。

## R26｜Jusen — GT2 Large Hand

https://www.jusenmodel.com/cnproducts/33-GT2-Large-Hand.html

查閱／使用範圍：既有調查之2S/1020整機參考；不是本板驅動電路或馬達電流來源。

## R27｜RadioLink — VDS200

https://www.radiolink.com/vds200

查閱／使用範圍：既有調查之2S/1020整機參考；未取得原廠功率原理圖。

## R28｜Texas Instruments — SN74LVC1G07

https://www.ti.com/lit/ds/symlink/sn74lvc1g07.pdf

查閱／使用範圍：新增PGOOD隔離；本次已檢視DBV pin圖與開汲極功能。

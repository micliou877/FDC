// ==================== FDC 靜態股池與對照資料 ====================
// ==================== 台股 34 大族群分類 ====================
const SECTORS = {
  "1. AI晶片設計與IP": [{code:"2330",name:"台積電"},{code:"2454",name:"聯發科"},{code:"3443",name:"創意"},{code:"3661",name:"世芯-KY"},{code:"3035",name:"智原"},{code:"6643",name:"M31"},{code:"5274",name:"信驊"},{code:"2379",name:"瑞昱"},{code:"6531",name:"愛普*"},{code:"3529",name:"力旺"}],
  "2. 先進封裝與封測": [{code:"3711",name:"日月光投控"},{code:"6239",name:"力成"},{code:"2449",name:"京元電"},{code:"6147",name:"頎邦"},{code:"6510",name:"精測"},{code:"6515",name:"穎崴"},{code:"6451",name:"訊芯-KY"},{code:"3189",name:"景碩"},{code:"2329",name:"華泰"}],
  "3. AI伺服器ODM": [{code:"2317",name:"鴻海"},{code:"2382",name:"廣達"},{code:"3231",name:"緯創"},{code:"6669",name:"緯穎"},{code:"2356",name:"英業達"},{code:"2376",name:"技嘉"},{code:"3706",name:"神達"},{code:"2324",name:"仁寶"},{code:"4938",name:"和碩"},{code:"2377",name:"微星"},{code:"2353",name:"宏碁"},{code:"2357",name:"華碩"},{code:"3533",name:"嘉澤"}],
  "4. 散熱與液冷": [{code:"3017",name:"奇鋐"},{code:"3324",name:"雙鴻"},{code:"3653",name:"健策"},{code:"2308",name:"台達電"},{code:"6805",name:"富世達"},{code:"3013",name:"晟銘電"},{code:"8996",name:"高力"},{code:"2421",name:"建準"},{code:"6230",name:"尼得科超眾"},{code:"6125",name:"廣運"},{code:"3483",name:"力致"}],
  "5. 記憶體循環": [{code:"2408",name:"南亞科"},{code:"2344",name:"華邦電"},{code:"6770",name:"力積電"},{code:"2337",name:"旺宏"},{code:"3006",name:"晶豪科"},{code:"8299",name:"群聯"},{code:"3260",name:"威剛"},{code:"4967",name:"十銓"},{code:"2451",name:"創見"},{code:"5289",name:"宜鼎"},{code:"8271",name:"宇瞻"},{code:"8110",name:"華東"}],
  "6. 伺服器機殼": [{code:"8210",name:"勤誠"},{code:"3013",name:"晟銘電"},{code:"3693",name:"營邦"},{code:"6117",name:"迎廣"},{code:"3032",name:"偉訓"}],
  "7. 被動元件": [{code:"2327",name:"國巨*"},{code:"2492",name:"華新科"},{code:"3026",name:"禾伸堂"},{code:"3357",name:"臺慶科"},{code:"2375",name:"凱美"},{code:"2428",name:"興勤"},{code:"2472",name:"立隆電"},{code:"2478",name:"大毅"},{code:"5328",name:"華容"},{code:"6155",name:"鈞寶"},{code:"6173",name:"信昌電"},{code:"6449",name:"鈺邦"},{code:"8043",name:"蜜望實"}],
  "8. PCB與CCL載板": [{code:"8046",name:"南電"},{code:"3037",name:"欣興"},{code:"3189",name:"景碩"},{code:"2368",name:"金像電"},{code:"4958",name:"臻鼎-KY"},{code:"3044",name:"健鼎"},{code:"6213",name:"聯茂"},{code:"2383",name:"台光電"},{code:"6274",name:"台燿"},{code:"2313",name:"華通"},{code:"2367",name:"燿華"},{code:"2355",name:"敬鵬"},{code:"5439",name:"高技"},{code:"6191",name:"精成科"},{code:"8021",name:"尖點"},{code:"8358",name:"金居"}],
  "9. CPO與光通訊": [{code:"3081",name:"聯亞"},{code:"2455",name:"全新"},{code:"4971",name:"IET-KY"},{code:"3163",name:"波若威"},{code:"6442",name:"光聖"},{code:"4979",name:"華星光"},{code:"3450",name:"聯鈞"},{code:"4977",name:"眾達-KY"},{code:"4906",name:"正文"}],
  "10. AI電源與BBU": [{code:"2308",name:"台達電"},{code:"2301",name:"光寶科"},{code:"1504",name:"東元"},{code:"1519",name:"華城"},{code:"6282",name:"康舒"},{code:"6125",name:"廣運"},{code:"3211",name:"順達"},{code:"6121",name:"新普"},{code:"6415",name:"矽力-KY"},{code:"6138",name:"茂達"},{code:"8081",name:"致新"}],
  "11. 機構件與滑軌": [{code:"2059",name:"川湖"},{code:"3376",name:"新日興"},{code:"2474",name:"可成"},{code:"6805",name:"富世達"},{code:"1569",name:"濱川"}],
  "12. 廠務工程": [{code:"2404",name:"漢唐"},{code:"6139",name:"亞翔"},{code:"6196",name:"帆宣"},{code:"6691",name:"洋基工程"},{code:"5536",name:"聖暉*"},{code:"6667",name:"信紘科"},{code:"7703",name:"銳澤"},{code:"3402",name:"漢科"},{code:"6788",name:"華景電"},{code:"2221",name:"大甲"}],
  "13. 半導體設備": [{code:"3131",name:"弘塑"},{code:"3583",name:"辛耘"},{code:"6187",name:"萬潤"},{code:"2467",name:"志聖"},{code:"5443",name:"均豪"},{code:"6640",name:"均華"},{code:"3413",name:"京鼎"},{code:"7769",name:"鴻勁"},{code:"6223",name:"旺矽"},{code:"2360",name:"致茂"},{code:"3680",name:"家登"},{code:"1560",name:"中砂"},{code:"3551",name:"世禾"},{code:"3167",name:"大量"},{code:"6739",name:"竹陞科"},{code:"4749",name:"新應材"},{code:"4772",name:"台特化"},{code:"8028",name:"昇陽半"},{code:"5285",name:"界霖"},{code:"3030",name:"德律"}],
  "14. 面板與螢幕": [{code:"2409",name:"友達"},{code:"3481",name:"群創"},{code:"6147",name:"頎邦"},{code:"2489",name:"瑞軒"},{code:"3673",name:"TPK-KY"},{code:"8069",name:"元太"},{code:"6116",name:"彩晶"},{code:"3527",name:"聚積"}],
  "15. 資安概念股": [{code:"6690",name:"安碁資訊"},{code:"2471",name:"資通"},{code:"4953",name:"緯軟"},{code:"3558",name:"神準"},{code:"6561",name:"是方"},{code:"6245",name:"立端"}],
  "16. AI軟體與雲端": [{code:"6214",name:"精誠"},{code:"6811",name:"宏碁資訊"},{code:"6689",name:"伊雲谷"},{code:"3029",name:"零壹"},{code:"6112",name:"邁達特"},{code:"2480",name:"敦陽科"},{code:"2453",name:"凌群"},{code:"8099",name:"大世科"},{code:"6870",name:"騰雲"}],
  "17. 工業電腦與邊緣AI": [{code:"2395",name:"研華"},{code:"6414",name:"樺漢"},{code:"6166",name:"凌華"},{code:"8234",name:"新漢"},{code:"3088",name:"艾訊"},{code:"3005",name:"神基"},{code:"6680",name:"鑫創電子"},{code:"6206",name:"飛捷"},{code:"3479",name:"安勤"},{code:"8114",name:"振樺電"},{code:"3564",name:"其陽"},{code:"6416",name:"瑞祺電通"},{code:"8050",name:"廣積"},{code:"3022",name:"威強電"},{code:"2397",name:"友通"},{code:"3416",name:"融程電"},{code:"5258",name:"虹堡"},{code:"3594",name:"磐儀"},{code:"6570",name:"維田"},{code:"5474",name:"聰泰"},{code:"6569",name:"醫揚"}],
  "18. 軍工與低空經濟": [{code:"2634",name:"漢翔"},{code:"2645",name:"長榮航太"},{code:"2630",name:"亞航"},{code:"8033",name:"雷虎"},{code:"3718",name:"中光電投控"},{code:"7719",name:"碳基"},{code:"2429",name:"銘旺科"},{code:"6753",name:"龍德造船"},{code:"2208",name:"台船"},{code:"2644",name:"中信造船"},{code:"5222",name:"全訊"},{code:"6829",name:"千附精密"},{code:"4541",name:"晟田"},{code:"8222",name:"寶一"}],
  "19. 機器人與人形機器人": [{code:"2049",name:"上銀"},{code:"4576",name:"大銀微系統"},{code:"1597",name:"直得"},{code:"4540",name:"全球傳動"},{code:"1536",name:"和大"},{code:"1590",name:"亞德客-KY"},{code:"2233",name:"宇隆"},{code:"7750",name:"新代"},{code:"4585",name:"達明"},{code:"6188",name:"廣明"},{code:"8374",name:"羅昇"},{code:"2464",name:"盟立"},{code:"2359",name:"所羅門"}],
  "20. AI_PC與智慧手機": [{code:"2357",name:"華碩"},{code:"2353",name:"宏碁"},{code:"2376",name:"技嘉"},{code:"2377",name:"微星"},{code:"3515",name:"華擎"},{code:"2382",name:"廣達"},{code:"3231",name:"緯創"},{code:"2317",name:"鴻海"},{code:"2324",name:"仁寶"},{code:"2356",name:"英業達"},{code:"4938",name:"和碩"},{code:"4966",name:"譜瑞-KY"},{code:"6415",name:"矽力-KY"},{code:"6138",name:"茂達"},{code:"4961",name:"天鈺"},{code:"5269",name:"祥碩"},{code:"6121",name:"新普"},{code:"3211",name:"順達"}],
  "21. 低軌衛星與6G": [{code:"3491",name:"昇達科"},{code:"2313",name:"華通"},{code:"6285",name:"啟碁"},{code:"2367",name:"燿華"},{code:"2355",name:"敬鵬"},{code:"6274",name:"台燿"},{code:"2383",name:"台光電"},{code:"6271",name:"同欣電"},{code:"3105",name:"穩懋"},{code:"2455",name:"全新"},{code:"3081",name:"聯亞"},{code:"4977",name:"眾達-KY"},{code:"2419",name:"仲琦"},{code:"6163",name:"華電網"},{code:"4916",name:"事欣科"},{code:"3481",name:"群創"},{code:"6443",name:"元晶"},{code:"7717",name:"萊德光電-KY"}],
  "22. 車用自駕與EV": [{code:"2330",name:"台積電"},{code:"2454",name:"聯發科"},{code:"3034",name:"聯詠"},{code:"3008",name:"大立光"},{code:"6488",name:"環球晶"},{code:"2401",name:"凌陽"},{code:"5347",name:"世界先進"},{code:"2308",name:"台達電"},{code:"3653",name:"健策"},{code:"2327",name:"國巨*"},{code:"2492",name:"華新科"},{code:"1504",name:"東元"},{code:"1536",name:"和大"},{code:"2231",name:"為升"},{code:"2236",name:"百達-KY"},{code:"1503",name:"士電"},{code:"2317",name:"鴻海"},{code:"2376",name:"技嘉"},{code:"2360",name:"致茂"},{code:"6573",name:"虹揚-KY"},{code:"3665",name:"貿聯-KY"}],
  "23. 矽光子與CPO": [{code:"3363",name:"上詮"},{code:"6451",name:"訊芯-KY"},{code:"6271",name:"同欣電"},{code:"2330",name:"台積電"},{code:"3711",name:"日月光投控"},{code:"6223",name:"旺矽"},{code:"6515",name:"穎崴"},{code:"3583",name:"辛耘"},{code:"6187",name:"萬潤"},{code:"2345",name:"智邦"},{code:"3443",name:"創意"}],
  "24. 重電電網與儲能": [{code:"1519",name:"華城"},{code:"1503",name:"士電"},{code:"1513",name:"中興電"},{code:"1514",name:"亞力"},{code:"2371",name:"大同"},{code:"1504",name:"東元"},{code:"6282",name:"康舒"},{code:"1605",name:"華新"},{code:"1612",name:"宏泰"},{code:"1615",name:"大山"},{code:"1603",name:"華電"},{code:"1611",name:"中電"},{code:"1609",name:"大亞"},{code:"6244",name:"茂迪"}],
  "25. 消費復甦與電商": [{code:"2949",name:"欣新網"},{code:"8044",name:"網家-KY"},{code:"2723",name:"美食-KY"},{code:"2912",name:"統一超"},{code:"5903",name:"全家"},{code:"1216",name:"統一"},{code:"9921",name:"巨大"},{code:"9914",name:"美利達"},{code:"2731",name:"雄獅"},{code:"5706",name:"鳳凰"},{code:"2706",name:"第一店"},{code:"2929",name:"淘帝-KY"},{code:"2727",name:"王品"},{code:"2618",name:"長榮航"},{code:"2610",name:"華航"},{code:"1476",name:"儒鴻"},{code:"9910",name:"豐泰"},{code:"9904",name:"寶成"},{code:"1417",name:"嘉裕"},{code:"1409",name:"新纖"}],
  "26. ETF權值股核心": [{code:"2330",name:"台積電"},{code:"2317",name:"鴻海"},{code:"2454",name:"聯發科"},{code:"6669",name:"緯穎"},{code:"2382",name:"廣達"},{code:"2308",name:"台達電"},{code:"2891",name:"中信金"},{code:"2881",name:"富邦金"},{code:"2412",name:"中華電"},{code:"2303",name:"聯電"},{code:"3231",name:"緯創"},{code:"3711",name:"日月光投控"},{code:"1303",name:"南亞"},{code:"1301",name:"台塑"},{code:"2882",name:"國泰金"},{code:"2002",name:"中鋼"},{code:"5871",name:"中租-KY"},{code:"3008",name:"大立光"},{code:"1216",name:"統一"},{code:"2207",name:"和泰車"},{code:"2603",name:"長榮"},{code:"2884",name:"玉山金"},{code:"2886",name:"兆豐金"}],
  "27. 功率半導體/第三代半導體": [
    {code:"5347",name:"世界先進"},{code:"3707",name:"漢磊"},{code:"3016",name:"嘉晶"},
    {code:"6488",name:"環球晶"},{code:"6182",name:"合晶"},
    {code:"6415",name:"矽力-KY"},{code:"6138",name:"茂達"},{code:"3105",name:"穩懋"},
    {code:"8255",name:"朋程"},{code:"3675",name:"德微"},{code:"5425",name:"台半"},{code:"8261",name:"富鼎"},
    {code:"2436",name:"偉詮電"},{code:"6573",name:"虹揚-KY"},
    {code:"8086",name:"宏捷科"},{code:"2308",name:"台達電"},
    {code:"6435",name:"大中⭐"},{code:"2481",name:"強茂⭐"},{code:"5299",name:"杰力⭐"}
  ],
  "28. 邊緣運算/Edge AI": [
    // A. 邊緣 AI 晶片設計
    {code:"2454",name:"聯發科"},{code:"3034",name:"聯詠"},{code:"5274",name:"信驊"},
    {code:"2379",name:"瑞昱"},{code:"3661",name:"世芯-KY"},{code:"3035",name:"智原"},
    {code:"5471",name:"松翰"},{code:"6531",name:"愛普*"},{code:"6643",name:"M31"},
    {code:"8081",name:"致新"},{code:"6138",name:"茂達"},{code:"3530",name:"晶相光"},
    {code:"3014",name:"聯陽"},{code:"3556",name:"禾瑞亞"},
    // B. 邊緣 AI 軟體/平台/應用（工業電腦硬體歸於族群 17，避免重複）
    {code:"6870",name:"騰雲"},{code:"2359",name:"所羅門"},{code:"6214",name:"精誠"},
    {code:"6811",name:"宏碁資訊"},{code:"6689",name:"伊雲谷"},{code:"2480",name:"敦陽科"},
    {code:"2453",name:"凌群"},{code:"6112",name:"邁達特"},
    // C. 智慧家居/AIoT 網通
    {code:"3596",name:"智易"},{code:"6285",name:"啟碁"}
  ],
  "29. IDM整合元件製造商": [
    // A. 記憶體 IDM
    {code:"2408",name:"南亞科"},{code:"2344",name:"華邦電"},
    {code:"6770",name:"力積電"},{code:"2337",name:"旺宏"},{code:"3006",name:"晶豪科"},
    // B. 功率半導體 IDM（自有晶圓廠：SiC/GaN/二極體/整流器）
    {code:"5347",name:"世界先進"},{code:"3707",name:"漢磊"},
    {code:"3016",name:"嘉晶"},{code:"6182",name:"合晶"},
    {code:"8255",name:"朋程"},{code:"2481",name:"強茂⭐"},{code:"5425",name:"台半"},
    {code:"3675",name:"德微"},{code:"6573",name:"虹揚-KY"},
    // C. MCU / 利基 IDM（自有晶圓廠）
    {code:"4919",name:"新唐"},
    // D. 化合物半導體 IDM / 磊晶
    {code:"3105",name:"穩懋"},{code:"8086",name:"宏捷科"},
    {code:"2455",name:"全新"},{code:"3081",name:"聯亞"},
    // E. 矽晶圓/上游材料
    {code:"6488",name:"環球晶"}
  ],
  "30. 半導體通路": [
    // 核心 IC 通路商
    {code:"3036",name:"文曄"},   // 全球第二大、ST/onsemi 代理
    {code:"3702",name:"大聯大"}, // 全球第一大、Infineon/MPWR 代理
    // 二線 IC 通路與半導體材料代理
    {code:"3048",name:"益登"},
    {code:"8112",name:"至上"},
    {code:"3033",name:"威健"},
    {code:"5434",name:"崇越"}
  ],
  "31. MCU微控制器": [
    // A. 第一級：題材純度高（核心持股）
    {code:"4919",name:"新唐"},       // 車用/工控MCU最強、BMC、TPM、IDM，92%MCU ⭐⭐⭐
    {code:"6907",name:"雅特力-KY"},  // 純32位元MCU、邊緣AI/機器人/無人機，2026/1上櫃 ⭐⭐⭐
    // B. 第二級：題材明確
    {code:"6202",name:"盛群"},       // 安防/健康量測、75%MCU、訂單見度到年底 ⭐⭐
    {code:"5471",name:"松翰"},       // AI PC晶片、無人機圖傳、車用MCU ⭐⭐
    {code:"6716",name:"應廣"},       // 伺服器散熱風扇MCU、2026/1營收年增230% ⭐
    // C. 第三級：漲價受惠/利基
    {code:"2458",name:"義隆"},       // 觸控IC+MCU、PC周邊
    {code:"2401",name:"凌陽"},       // 車用MCU、ADAS、成本轉嫁
    {code:"4952",name:"凌通"},       // MCU+多媒體IC
    {code:"6494",name:"九齊"},       // 消費MCU+語音IC、2026/1營收近兩年高
    {code:"3122",name:"笙泉"},       // 工控MCU
    {code:"6129",name:"普誠"},       // 消費MCU+Audio
    {code:"5302",name:"太欣"},       // 消費MCU
    // D. MCU成熟製程晶圓代工（上游受惠）
    {code:"2303",name:"聯電"}        // Wi-Fi/MCU/PMIC 8吋成熟製程，受惠最直接 ⭐⭐⭐
  ],
  "32. 控股折價/業外獲利觀察名單": [
    // A. 持有上市子公司型（NAV 折價最明確）
    {code:"2316",name:"楠梓電"},     // 持有滬電股份，look-through NAV 折價約74%，Palliser Capital介入中 ⭐標竿案例
    {code:"4958",name:"臻鼎-KY"},    // 持有鵬鼎控股，同結構但幾乎無折價 — 對照組
    {code:"1605",name:"華新"},       // 交叉持股華新科/瀚宇博/彩晶
    {code:"2915",name:"潤泰全"},     // 持有南山人壽
    {code:"9945",name:"潤泰新"},     // 持有南山人壽
    {code:"1402",name:"遠東新"},     // 遠東集團控股，持有亞泥/遠傳/遠百
    {code:"1229",name:"聯華"},       // 持有聯華食/聯華氣體
    {code:"2371",name:"大同"},       // 持有尚志/福華等，治理紀錄需留意
    {code:"2204",name:"中華"},       // 持有華創車電
    {code:"1304",name:"台聚"},       // 台聚集團交叉持股（亞聚/華夏）
    // B. 既有族群中的「業外貢獻型」（財報結構需特別標註，已存在於其他族群）
    {code:"4919",name:"新唐"},       // 業外含Autotalks被高通收購認列，本業營益率仍負
    {code:"2344",name:"華邦電"},     // 持有新唐，集團認列關係
    {code:"6116",name:"彩晶"},       // 本業虧損，靠資產活化題材
    {code:"3481",name:"群創"},       // 歷史上多次靠資產處分認列
    {code:"2409",name:"友達"},       // 面板業共同特徵，資產處分認列
    {code:"2327",name:"國巨*"},      // 持有凱美/信昌電等
    // C. 資產型（土地重估價值 > 市值，變現難度更高）
    {code:"1903",name:"士紙"},       // 士林土地
    {code:"2913",name:"農林"},       // 全台茶園、林地
    {code:"1416",name:"廣豐"},       // 桃園土地
    {code:"1437",name:"勤益控"},     // 台中土地
    {code:"1472",name:"三洋紡"}      // 土地資產
  ],
  "33. 醫材/生技美容": [
    {code:"6949",name:"沛爾生醫-創"}   // 玻尿酸填充劑/醫美耗材
  ],
  "34. 玻纖布/CCL上游材料": [
    {code:"1815",name:"富喬"},   // 電子級玻纖紗/布, Low-Dk低介電 (AI PCB核心材料)
    {code:"1802",name:"台玻"},   // 玻纖紗/布 + 玻璃
    {code:"5475",name:"德宏"},   // 印刷電路板用玻纖布
    {code:"5340",name:"建榮"}    // 玻纖布
  ],
  "35. 航運與海運": [
    {code:"2603",name:"長榮"},
    {code:"2609",name:"陽明"},
    {code:"2615",name:"萬海"},
    {code:"2637",name:"慧洋-KY"}
  ]
};

const GLOBAL_LIST = {
  "US": [
    {code:"NVDA",  ex:"NASDAQ", name:"NVIDIA 輝達 (AI晶片)"},
    {code:"AMD",   ex:"NASDAQ", name:"AMD 超微 (GPU/CPU)"},
    {code:"AVGO",  ex:"NASDAQ", name:"Broadcom 博通 (ASIC/網通)"},
    {code:"TSLA",  ex:"NASDAQ", name:"Tesla 特斯拉 (車用/機器人)"},
    {code:"SMCI",  ex:"NASDAQ", name:"Super Micro (AI伺服器)"},
    {code:"DELL",  ex:"NYSE",   name:"Dell 戴爾 (AI伺服器/PC)"},
    {code:"VRT",   ex:"NYSE",   name:"Vertiv (散熱/電源)"},
    {code:"MU",    ex:"NASDAQ", name:"Micron 美光 (記憶體)"},
    {code:"AMKR",  ex:"NASDAQ", name:"Amkor (先進封測)"},
    {code:"COHR",  ex:"NYSE",   name:"Coherent (CPO/光通訊)"},
    {code:"AMAT",  ex:"NASDAQ", name:"Applied Materials (設備)"},
    {code:"ASML",  ex:"NASDAQ", name:"ASML (EUV設備)"},
    {code:"PANW",  ex:"NASDAQ", name:"Palo Alto (資安)"},
    {code:"MSFT",  ex:"NASDAQ", name:"Microsoft 微軟 (雲端/AI軟體)"},
    {code:"AAPL",  ex:"NASDAQ", name:"Apple 蘋果 (手機/邊緣AI)"},
    {code:"AMZN",  ex:"NASDAQ", name:"Amazon 亞馬遜 (雲端/電商)"},
    {code:"LMT",   ex:"NYSE",   name:"Lockheed Martin (軍工)"},
    {code:"IFX",   ex:"XETRA",  name:"Infineon 英飛凌 (功率半導體龍頭/NVIDIA 800V合作)"},
    {code:"STM",   ex:"NYSE",   name:"STMicroelectronics ST微電子 (SiC IDM)"},
    {code:"ON",    ex:"NASDAQ", name:"ON Semiconductor 安森美 (車用功率)"},
    {code:"MPWR",  ex:"NASDAQ", name:"Monolithic Power Systems (AI電源IC)"},
    {code:"POWI",  ex:"NASDAQ", name:"Power Integrations (高壓GaN IC)"},
    {code:"NVTS",  ex:"NASDAQ", name:"Navitas Semiconductor (純GaN/SiC設計)"},
    {code:"WOLF",  ex:"NYSE",   name:"Wolfspeed (SiC龍頭/重整中)"},
    {code:"ARW",   ex:"NYSE",   name:"Arrow Electronics (美系半導體通路龍頭)"},
    {code:"AVT",   ex:"NASDAQ", name:"Avnet (美系半導體通路第二大)"},
    {code:"GOOGL", ex:"NASDAQ", name:"Alphabet 谷歌 (搜尋/雲端/AI)"},
    {code:"META",  ex:"NASDAQ", name:"Meta (社群/AI)"},
    {code:"NFLX",  ex:"NASDAQ", name:"Netflix 網飛 (串流)"},
    {code:"QCOM",  ex:"NASDAQ", name:"Qualcomm 高通 (手機晶片)"},
    {code:"TXN",   ex:"NASDAQ", name:"Texas Instruments 德州儀器 (類比IC/MCU)"},
    {code:"MCHP",  ex:"NASDAQ", name:"Microchip Technology 微芯科技 (MCU+混合訊號龍頭)"},
    {code:"NXPI",  ex:"NASDAQ", name:"NXP Semiconductors 恩智浦 (車用MCU市占最高)"},
    {code:"INTC",  ex:"NASDAQ", name:"Intel 英特爾 (CPU/晶圓代工)"},
    {code:"ARM",   ex:"NASDAQ", name:"ARM Holdings (IP授權)"},
    {code:"CRM",   ex:"NYSE",   name:"Salesforce (企業軟體/AI)"},
    {code:"ORCL",  ex:"NYSE",   name:"Oracle 甲骨文 (雲端/資料庫)"},
    {code:"JPM",   ex:"NYSE",   name:"JPMorgan 摩根大通 (金融)"},
    {code:"V",     ex:"NYSE",   name:"Visa (支付)"},
    {code:"SE",    ex:"NYSE",   name:"Sea Limited 冬海集團 (Shopee/遊戲)"},
    {code:"BABA",  ex:"NYSE",   name:"Alibaba 阿里巴巴 (電商/雲端)"},
    {code:"PDD",   ex:"NASDAQ", name:"PDD Holdings 拼多多 (電商)"},
    {code:"JD",    ex:"NASDAQ", name:"JD.com 京東 (電商)"},
    {code:"NIO",   ex:"NYSE",   name:"NIO 蔚來汽車 (電動車)"},
    {code:"XPEV",  ex:"NYSE",   name:"XPeng 小鵬汽車 (電動車)"},
    {code:"LI",    ex:"NASDAQ", name:"Li Auto 理想汽車 (電動車)"},
    {code:"BIDU",  ex:"NASDAQ", name:"Baidu 百度 (搜尋/AI)"},
    {code:"NTES",  ex:"NASDAQ", name:"NetEase 網易 (遊戲)"},
    {code:"BILI",  ex:"NASDAQ", name:"Bilibili 嗶哩嗶哩 (影音)"},
    {code:"FUTU",  ex:"NASDAQ", name:"Futu Holdings 富途證券"},
    {code:"TIGR",  ex:"NASDAQ", name:"UP Fintech 老虎證券"},
    {code:"GRAB",  ex:"NASDAQ", name:"Grab Holdings 東南亞版Uber"},
    {code:"TSM",   ex:"NYSE",   name:"TSMC 台積電 ADR"},
  ],
  "JP": [{code:"6857",name:"Advantest (AI測試機)"},{code:"8035",name:"Tokyo Electron (半導體設備)"},{code:"6981",name:"Murata 村田 (被動元件)"},{code:"6146",name:"Disco (晶圓切割)"},{code:"6594",name:"Nidec (馬達/機器人)"}],
  "KR": [{code:"005930",name:"Samsung 三星 (記憶體/代工)"},{code:"000660",name:"SK Hynix (HBM龍頭)"}]
};

// 上櫃 (TPEX) 股票代碼對照表，用於無 FinMind 資料時產生正確連結
// ⚠️ 若連結連錯交易所，抓取一次 FinMind 資料後即可自動修正（最準確）
// ⚠️ 也可在下方 MANUAL_MARKETS 手動指定個別股票的交易所
const TPEX_CODES = new Set([
  // 族群1
  "3661","3035","6643","5274","6531","5471","8081",
  // 族群2
  "6147","3105","6510","6451","3189","3530","3014",
  // 族群4
  "3324","3653","6805","3013","8996","6125","3483","4943",
  // 族群5
  "3006","8299","5289",
  // 族群6
  "8210","3693","6117","3032",
  // 族群7（移除 6173 信昌電 → TWSE）
  "3357","6155","3686","8043","3026",
  // 族群8
  "6213","6274","5439","8101","8021","8358",
  // 族群9
  "3081","4971","3163","3363","6442","4979","3450","4977","6271","4906",
  // 族群10
  "6282","3211","6121",
  // 族群11
  "3376",
  // 族群12
  "6139","6196","6691","6667","7703","3402","6788",
  // 族群13
  "3131","3583","6187","5443","6640","3413","7769","6223","3680",
  "3551","3167","6739","4749","4772","8028",
  // 族群14
  "8069","6116",
  // 族群15
  "6690","4953","3558","6561","6245",
  // 族群16
  "6811","6689","3029","6112","8099","6870",
  // 族群17
  "6166","8234","3088","3005","6680","6206","3479","8114","3564",
  "6416","8050","3022","3416","5258","3594","6570","5474","6569",
  // 族群18
  "8033","7719","5222","6829","4541","8222","6163","4916",
  "6443","7717",
  // 族群19
  "4576","1597","4585","6188","8374","2464","6128","2359","6789",
  // 族群20
  "4966","6415","6138","4961","5269",
  // 族群21
  "6285",
  // 族群22
  "2231","2236","6485","6515","4540","3030","3454","6573","3665",
  // 族群24
  "6244","8086",
  // 族群27 功率半導體/第三代半導體（新增）
  "3707","3016","6182","8255","8048","8261","6202",
  "6435","5299", // 大中、杰力（MOSFET 補強）
  // 族群30 半導體通路
  "3060","8121", // 銘異、越峰（二線通路）
]);

// ==================== 股票交易所明細表（TWSE=上市 / TPEX=上櫃）====================
// 優先權最高，蓋過 FinMind 回傳值與 TPEX_CODES 猜測邏輯
// 逐步擴充中，確認有效後再補全部股票
// ==================== 完整股票交易所對照表 ====================
// 涵蓋 SECTORS 所有標的。優先權高於 FinMind 與 TPEX_CODES 猜測。
// 若發現錯誤直接修改此處即可。
const STOCK_EXCHANGE = {
  // ── 上市 TWSE ─────────────────────────────────
  "1216":"TWSE","1301":"TWSE","1303":"TWSE","1409":"TWSE","1417":"TWSE",
  "1466":"TWSE","1476":"TWSE","1503":"TWSE","1504":"TWSE",
  "1513":"TWSE","1514":"TWSE","1519":"TWSE","1536":"TWSE","1560":"TWSE",
  "1590":"TWSE","1603":"TWSE","1604":"TWSE","1605":"TWSE","1609":"TWSE",
  "1611":"TWSE","1612":"TWSE","1615":"TWSE","1815":"TPEX",
  "2002":"TWSE","2049":"TWSE","2059":"TWSE","2207":"TWSE","2208":"TWSE",
  "2233":"TWSE","2301":"TWSE","2303":"TWSE","2308":"TWSE","2313":"TWSE",
  "2317":"TWSE","2324":"TWSE","2327":"TWSE","2329":"TWSE","2330":"TWSE",
  "2337":"TWSE","2344":"TWSE","2345":"TWSE","2353":"TWSE","2355":"TWSE",
  "2356":"TWSE","2357":"TWSE","2360":"TWSE","2367":"TWSE","2368":"TWSE",
  "2371":"TWSE","2375":"TWSE","2376":"TWSE","2377":"TWSE","2379":"TWSE",
  "2382":"TWSE","2383":"TWSE","2395":"TWSE","2397":"TWSE","2401":"TWSE",
  "2404":"TWSE","2408":"TWSE","2409":"TWSE","2412":"TWSE","2413":"TWSE",
  "2419":"TWSE","2421":"TWSE","2428":"TWSE","2429":"TWSE","2436":"TWSE","2449":"TWSE",
  "2451":"TWSE","2454":"TWSE","2455":"TWSE","2467":"TWSE","2471":"TWSE",
  "2472":"TWSE","2474":"TWSE","2478":"TWSE","2480":"TWSE","2481":"TWSE","2489":"TWSE",
  "2492":"TWSE","2603":"TWSE","2609":"TWSE","2610":"TWSE","2615":"TWSE",
  "2618":"TWSE","2630":"TWSE","2634":"TWSE","2637":"TWSE","2644":"TPEX",
  "2645":"TWSE","2706":"TWSE","2723":"TWSE","2727":"TWSE","2731":"TWSE",
  "2881":"TWSE","2882":"TWSE","2884":"TWSE","2886":"TWSE","2891":"TWSE",
  "2453":"TWSE","2912":"TWSE","2929":"TWSE","2949":"TPEX","3008":"TWSE","3034":"TWSE",
  "3036":"TWSE","3037":"TWSE","3044":"TWSE","3231":"TWSE","3260":"TPEX","3443":"TWSE",
  "3481":"TWSE","3491":"TPEX","3515":"TWSE","3673":"TWSE","3702":"TWSE","3706":"TWSE",
  "3711":"TWSE","4763":"TWSE","4938":"TWSE","4958":"TWSE","4967":"TWSE",
  "5285":"TWSE","5299":"TPEX","5328":"TPEX","5347":"TPEX","5536":"TPEX",
  "5706":"TWSE","5871":"TWSE","5903":"TPEX","6168":"TWSE","6214":"TWSE",
  "6239":"TWSE","6414":"TWSE","6488":"TPEX","6669":"TWSE","6753":"TWSE",
  "6770":"TWSE","7750":"TWSE","8016":"TWSE","8046":"TWSE","8473":"TWSE",
  "9910":"TWSE","9914":"TWSE","9919":"TWSE","9921":"TWSE","9941":"TWSE",
  // ── 上櫃 TPEX ─────────────────────────────────
  "1597":"TWSE","1784":"TPEX",
  "2231":"TWSE","2236":"TWSE","2359":"TWSE","2464":"TWSE","2494":"TPEX",
  "3005":"TWSE","3006":"TWSE","3013":"TWSE","3014":"TWSE","3016":"TWSE",
  "3017":"TWSE","3022":"TWSE","3024":"TWSE","3026":"TWSE",
  "3029":"TWSE","3030":"TWSE","3032":"TWSE","3035":"TWSE","3060":"TWSE","3081":"TPEX",
  "3088":"TPEX","3105":"TPEX","3131":"TPEX","3163":"TPEX","3167":"TWSE",
  "3189":"TWSE","3211":"TPEX","3324":"TPEX","3357":"TPEX","3363":"TPEX","3376":"TWSE",
  "3402":"TPEX","3413":"TWSE","3416":"TWSE","3450":"TWSE","3454":"TPEX",
  "3479":"TPEX","3483":"TPEX","3530":"TWSE","3551":"TPEX","3556":"TPEX","3558":"TPEX",
  "3564":"TPEX","3583":"TWSE","3594":"TPEX","3596":"TWSE","3653":"TWSE","3661":"TWSE",
  "3665":"TWSE","3680":"TPEX","3686":"TWSE","3693":"TPEX","3704":"TWSE",
  "3707":"TPEX","3718":"TPEX",
  "4540":"TWSE","4541":"TPEX","4576":"TWSE","4585":"TWSE","4749":"TPEX",
  "4772":"TPEX","4906":"TWSE","4916":"TWSE","4943":"TWSE","4953":"TPEX",
  "4961":"TWSE","4966":"TPEX","4971":"TPEX","4977":"TWSE","4979":"TPEX",
  "5222":"TWSE","5258":"TWSE","5269":"TWSE","5274":"TPEX","5289":"TPEX",
  "5388":"TWSE","5439":"TPEX","5443":"TPEX","5471":"TWSE",
  "5474":"TPEX",
  "6112":"TWSE","6116":"TWSE","6117":"TWSE","6121":"TPEX","6125":"TPEX",
  "6128":"TWSE","6138":"TPEX","6139":"TWSE","6147":"TPEX","6155":"TWSE",
  "6163":"TPEX","6166":"TWSE","6173":"TPEX","6182":"TPEX","6187":"TPEX",
  "6188":"TPEX","6191":"TWSE","6196":"TWSE","6202":"TWSE","6206":"TWSE","6213":"TWSE",
  "6223":"TPEX","6230":"TWSE","6244":"TPEX","6245":"TPEX","6271":"TWSE",
  "6274":"TPEX","6278":"TWSE","6282":"TWSE","6285":"TWSE","6286":"TWSE",
  "6415":"TWSE","6416":"TWSE","6435":"TPEX","6442":"TWSE","6443":"TWSE","6449":"TWSE","6451":"TWSE",
  "6485":"TPEX","6510":"TPEX","6515":"TWSE","6531":"TWSE","6561":"TPEX",
  "6569":"TPEX","6570":"TPEX","6573":"TWSE","6640":"TPEX","6643":"TPEX",
  "6667":"TPEX","6680":"TPEX","6689":"TWSE","6690":"TPEX","6691":"TWSE",
  "6739":"TPEX","6788":"TPEX","6789":"TWSE","6805":"TWSE","6811":"TPEX",
  "6829":"TPEX","6870":"TPEX","6907":"TPEX",
  "7703":"TPEX","7717":"TPEX","7719":"TPEX","7769":"TWSE",
  "8021":"TWSE","8028":"TWSE","8033":"TWSE","8038":"TPEX","8043":"TPEX",
  "8044":"TPEX","8048":"TPEX","8050":"TPEX","8069":"TPEX","8081":"TWSE",
  "8086":"TPEX","8099":"TPEX","8101":"TWSE","8110":"TWSE","8114":"TWSE","8121":"TPEX","8131":"TWSE",
  "8210":"TWSE","8222":"TWSE","8234":"TPEX","8255":"TPEX","8261":"TWSE","8271":"TWSE",
  "8299":"TPEX","8358":"TPEX","8374":"TWSE",
  // ── 族群32 控股折價/業外獲利觀察名單（新增）──────
  "2316":"TWSE","2915":"TWSE","9945":"TWSE","1402":"TWSE","1229":"TWSE",
  "2204":"TWSE","1304":"TWSE","1903":"TWSE","2913":"TWSE","1416":"TWSE",
  "1437":"TWSE","1472":"TWSE",
  // ── 補齊缺漏標的與本次新增標的（實測驗證）──────
  "1569":"TPEX","1802":"TWSE","2221":"TPEX","2458":"TWSE","3033":"TWSE",
  "3048":"TWSE","3122":"TPEX","3527":"TPEX","3529":"TPEX","3533":"TWSE",
  "3675":"TPEX","4919":"TWSE","4952":"TWSE","5302":"TPEX","5340":"TPEX",
  "5425":"TPEX","5434":"TWSE","5475":"TPEX","6129":"TPEX","6494":"TPEX",
  "6716":"TPEX","6949":"TWSE","8112":"TWSE","8996":"TWSE","9904":"TWSE",
};

// 後備（STOCK_EXCHANGE 未涵蓋的股票才會用到）
const MANUAL_MARKETS = {};

// ==================== 29族群核心美股對應（2026/06整理）====================
// ★ = NVIDIA點名  ★★ = NVIDIA直接入股/點名超強連動
const SECTOR_US = {
  "1. AI晶片設計與IP":           "NVDA / AMD / AVGO★ / ARM / MRVL",
  "2. 先進封裝與封測":            "AMKR★ / TER / KEYS★",
  "3. AI伺服器ODM":              "DELL★ / HPE / SMCI / JBL★",
  "4. 散熱與液冷":               "VRT★",
  "5. 記憶體循環":               "MU★ / SNDK★ / WDC★",
  "6. 伺服器機殼":               "VRT / SMCI",
  "7. 被動元件":                 "VSH / 村田6981.T / TDK6762.T",
  "8. PCB與CCL載板":             "GLW★ / Ibiden4062.T",
  "9. CPO與光通訊":              "COHR★★(入股) / LITE★★(入股) / GLW★ / ANET",
  "10. AI電源與BBU":             "VRT★ / ETN / MPWR",
  "11. 機構件與滑軌":             "JCI / VRT",
  "12. 廠務工程":                "AECOM / JCI",
  "13. 半導體設備":              "KLAC★ / LRCX★ / KEYS★ / AMAT / ASML",
  "14. 面板與螢幕":              "日韓為主：LGD / Samsung / Sony",
  "15. 資安概念股":              "PANW / CRWD / FTNT / ZS / OKTA",
  "16. AI軟體與雲端":            "MSFT / GOOGL / AMZN / META / CRM / ORCL",
  "17. 工業電腦與邊緣AI":         "NVDA(Jetson) / AMBA / QCOM",
  "18. 軍工與低空經濟":           "LMT / RTX / AVAV / KTOS / PLTR",
  "19. 機器人與人形機器人":        "TSLA(Optimus) / NVDA(Isaac) / ISRG / ABB",
  "20. AI_PC與智慧手機":         "AAPL / DELL / MSFT / QCOM(Snapdragon)",
  "21. 低軌衛星與6G":            "SpaceX(未上市) / AMZN(Kuiper) / ASTS",
  "22. 車用自駕與EV":            "TSLA / NVDA(Drive) / MBLY / ON★ / STM★",
  "23. 矽光子與CPO":             "COHR★★(入股) / LITE★★(入股) / GLW★ / ANET / IONQ",
  "24. 重電電網與儲能":           "ETN / GEV / VRT★ / PWR / CEG / VST",
  "25. 消費復甦與電商":           "AMZN / WMT / COST / NKE / SBUX",
  "26. ETF權值股核心":            "SPY / QQQ / SMH(半導體ETF) / SOXX",
  "27. 功率半導體/第三代半導體":   "STM★ / ON★ / MPWR / NVTS / WOLF / IFX(德)",
  "28. 邊緣運算/Edge AI":        "NVDA / AMBA / AVGO / QCOM / INTC / AMD",
  "29. IDM整合元件製造商":        "MU★ / INTC / STM★ / ON★ / TXN / ADI / WOLF",
  "30. 半導體通路":               "ARW / AVT (美系通路龍頭) / STM★ / ON★ / MPWR (被代理品牌)"
};

// ==================== 個股美股對應（從29族群備註整理）====================
const STOCK_US = {
  // 族群1 AI晶片設計
  "2330":"TSM","2454":"QCOM/AVGO","3661":"AVGO/MRVL","3443":"AVGO/MRVL",
  "3035":"AVGO","6643":"ARM","5274":"NVDA/AVGO","2379":"QCOM","6531":"MU","5471":"NXPI",
  // 族群2 先進封裝
  "3711":"AMKR★","6239":"AMKR","2449":"AMKR","6147":"COHR/LITE",
  "3105":"NVTS/WOLF","6510":"TER/KEYS","6451":"COHR",
  // 族群3 AI伺服器ODM
  "2317":"DELL/JBL★","2382":"DELL/HPE","3231":"DELL★(獨家)",
  "6669":"DELL/HPE/SMCI","2356":"HPE","2376":"SMCI/DELL",
  "4938":"AAPL/DELL","2377":"DELL","2353":"DELL","2357":"DELL/HPQ",
  // 族群4 散熱液冷
  "3017":"VRT★","3324":"VRT","3653":"VRT","6805":"VRT(QDC)","8996":"VRT(CDU)",
  "3013":"VRT","2421":"VRT","6125":"VRT","2059":"VRT/JCI",
  // 族群5 記憶體
  "2408":"MU★","2344":"MU/SNDK","6770":"MU","2337":"SNDK/WDC",
  "3006":"MU","8299":"SNDK/WDC","3260":"MU/WDC","4967":"MU","2451":"MU",
  // 族群9 CPO光通訊
  "3081":"COHR/LITE","2455":"COHR/LITE","4971":"COHR/LITE",
  "3163":"COHR/GLW","3363":"COHR/LITE","6442":"COHR/GLW",
  "4979":"COHR/LITE","3450":"COHR","4906":"CIEN","2345":"ANET",
  // 族群10 AI電源
  "2301":"VRT/ETN","1504":"ETN/GEV","6282":"VRT","3211":"VRT",
  // 族群11 機構件
  "3376":"JCI","2474":"AAPL/DELL",
  // 族群12 廠務工程
  "2404":"AECOM/JCI","6139":"AECOM","6196":"AMAT","6691":"JCI","5536":"JCI",
  // 族群13 半導體設備
  "3131":"LRCX/AMAT","3583":"AMAT","6187":"AMAT/ASML","2467":"AMAT",
  "5443":"AMAT","6640":"AMAT","3413":"AMAT","7769":"KEYS★/TER",
  "6223":"KLAC★","2360":"KEYS/TER","3680":"ASML/AMAT","1560":"AMAT",
  // 族群15 資安
  "6690":"PANW/CRWD","2471":"OKTA","4953":"PANW","3558":"PANW/FTNT",
  "6561":"EQIX","6245":"PANW",
  // 族群13 半導體設備
  "5285":"AMAT/ENTG", // 界霖（半導體耗材）
  // 族群16 AI軟體雲端
  "6214":"CRM/MSFT","6811":"MSFT","6689":"AMZN/GOOGL/MSFT",
  "3029":"MSFT/ORCL","6112":"MSFT","2480":"ORCL/MSFT","2453":"ORCL","8099":"MSFT",
  // 族群17 工業電腦
  "2395":"NVDA(Jetson)/AMBA","6414":"NVDA/MSFT","6166":"NVDA(Isaac)",
  "8234":"NVDA(Jetson)","3088":"NVDA","3005":"GOOGL(Edge TPU)",
  // 族群18 軍工
  "2634":"LMT/BA","8033":"AVAV","3718":"AVAV/KTOS","2645":"BA",
  "6753":"GD","5222":"RTX","6829":"LMT/RTX","2429":"AVAV/KTOS",
  "7719":"AVAV","2208":"GD","2644":"GD","2419":"PLTR/AMZN","1466":"AVAV",
  // 族群19 機器人
  "2049":"TSLA/ISRG","4576":"TSLA","4585":"ABB/TSLA","6188":"TSLA/ABB",
  "1536":"TSLA","2359":"NVDA★(Isaac)","7750":"TSLA/ABB","8374":"ABB","2464":"ABB",
  // 族群20 AI PC
  "4966":"AAPL","5269":"AMD","6121":"AAPL/DELL",
  // 族群21 低軌衛星
  "3491":"SpaceX/ASTS","6285":"SpaceX/AMZN","2313":"SpaceX","6271":"SpaceX",
  "7717":"SpaceX(雷射)","4916":"SpaceX",
  // 族群22 車用EV
  "2231":"TSLA/MBLY","3008":"MBLY","3034":"MBLY/ON","1815":"TSLA","6515":"TSLA",
  "1503":"TSLA/ETN","2236":"TSLA",
  // 族群24 重電電網
  "1519":"ETN/GEV","1513":"ETN/GEV","1514":"NVDA/ETN","2371":"GEV","6443":"FSLR",
  // 族群27 功率半導體
  "5347":"STM★/ON★","3707":"WOLF/STM","3016":"WOLF/STM","6488":"WOLF",
  "6182":"WOLF","8255":"ON★","3675":"ON/VSH","5425":"ON/VSH/STM","6573":"ON/VSH","8261":"ON/MPWR",
  "6415":"MPWR★","6138":"MPWR/ON","8081":"MPWR",
  "6435":"ON/VSH","2481":"ON/VSH/STM","5299":"ON/VSH",
  // 族群28 邊緣運算
  "3530":"AMBA","6870":"NVDA(Metropolis)/PLTR",
  // 族群29 IDM
  "2337":"SNDK/WDC","6770":"INTC","8086":"GaAs代工",
  // 族群30 半導體通路
  "3036":"ARW/AVT","3702":"ARW/AVT","3048":"ARW/AVT","8112":"ARW/AVT","3033":"ARW/AVT"
};

// ==================== 功率元件供應鏈層級（三層架構）====================
// 上層=功率半導體晶片  中層=PMIC設計  下層=電源模組/重電
const STOCK_POWER_LAYER = {
  // 上層 功率半導體晶片
  "5347":"功率·上層","3707":"功率·上層","3016":"功率·上層",
  "6488":"功率·上層","6182":"功率·上層","3105":"功率·上層",
  "8086":"功率·上層","3675":"功率·上層","5425":"功率·上層","8261":"功率·上層",
  "2436":"功率·上層","8255":"功率·上層","6573":"功率·上層",
  "6435":"功率·上層","2481":"功率·上層","5299":"功率·上層",
  // 中層 PMIC設計
  "6415":"功率·中層","6138":"功率·中層","8081":"功率·中層",
  "6531":"功率·中層","6643":"功率·中層","3035":"功率·中層",
  // 下層 電源模組/重電
  "2308":"功率·下層","2301":"功率·下層","6282":"功率·下層",
  "6121":"功率·下層","3211":"功率·下層","1519":"功率·下層",
  "1503":"功率·下層","1513":"功率·下層","1514":"功率·下層",
  "1504":"功率·下層","2371":"功率·下層"
};

// 「大甲型」隱形冠軍：各族群裡「利基龍頭＋有實質業績＋卡關鍵位置＋中小型＋有護城河」的那一檔，
// 原型是大甲(2221)在廠務族群的定位。用途：跟族群熱度榜並用——「熱門族群 ∩ 大甲型」＝族群熱+利基龍頭雙重優勢。
// 見 各族群_大甲型隱形冠軍對照表.md，value是該股卡的關鍵位置（顯示在tag的title提示裡）。
const STOCK_DAJIA = {
  "3529":"記憶體矽智財(IP)授權隱形冠軍","6515":"測試座/測試介面隱形冠軍","3533":"CPU/GPU插槽connector龍頭",
  "6805":"QDC水冷快接頭，液冷系統關鍵接點","5289":"工業級記憶體模組隱形冠軍","2059":"伺服器滑軌世界級隱形冠軍",
  "3357":"TLVR電感技術領先，AI電源專用被動件","8021":"PCB鑽孔針隱形冠軍","3081":"InP磊晶隱形冠軍，1.6T光模組上游關鍵材料",
  "3211":"BBU備援電池模組，AI機櫃斷電保護關鍵","1597":"線性滑軌利基廠","2221":"本尊：超潔淨管件閥件",
  "3680":"EUV Pod(光罩傳送盒)近乎獨佔","3527":"Mini/Micro LED驅動IC隱形冠軍","6245":"網安硬體全球ODM市占40-50%",
  "6870":"AIoT as a Service純度最高(注意流動性差)","6166":"邊緣AI+AMR利基","5222":"軍規GaAs功率放大器隱形冠軍",
  "2049":"滾珠螺桿/線性滑軌，機器人關節繞不過","4966":"高速介面IC隱形冠軍，AI PC傳輸關鍵",
  "3491":"毫米波元件隱形冠軍，衛星營收占比80%","2231":"TPMS胎壓偵測隱形冠軍","2455":"GaAs磊晶利基廠，光通訊上游材料",
  "1513":"GIS氣體絕緣開關85%市占隱形冠軍","2949":"電商代營運利基","8255":"車用整流二極體全球前三隱形冠軍",
  "3530":"影像感測SoC小型黑馬，邊緣視覺關鍵","2481":"MOSFET+二極體混合型功率IDM，自有產能",
  "5434":"半導體材料利基通路(信越代理)","6907":"純32位元中高階MCU，避開低階價格戰",
};

const STOCK_NAMES = {};
const STOCK_SECTORS_MAP = {};
Object.entries(SECTORS).forEach(([sec, list]) => {
  const shortName = sec.split('. ')[1] || sec;
  list.forEach(s => {
    STOCK_NAMES[s.code] = s.name;
    if(!STOCK_SECTORS_MAP[s.code]) STOCK_SECTORS_MAP[s.code] = [];
    STOCK_SECTORS_MAP[s.code].push(shortName);
  });
});
STOCK_NAMES["0050"] = "大盤(0050)"; 

const US_STOCK_NAMES = {
  NVDA: "NVIDIA", AMD: "AMD", AVGO: "Broadcom 博通", MRVL: "Marvell",
  MU: "Micron 美光", WDC: "Western Digital", SNDK: "SanDisk",
  AMKR: "Amkor", KLAC: "KLA", LRCX: "Lam Research", AMAT: "Applied Materials", KEYS: "Keysight",
  COHR: "Coherent", LITE: "Lumentum", GLW: "Corning 康寧", ANET: "Arista Networks",
  DELL: "Dell 戴爾", SMCI: "Super Micro",
  VRT: "Vertiv", ETN: "Eaton", GEV: "GE Vernova",
  STM: "STMicroelectronics", ON: "ON Semiconductor 安森美", MPWR: "Monolithic Power", WOLF: "Wolfspeed",
  MCHP: "Microchip", TXN: "Texas Instruments 德州儀器", ADI: "Analog Devices",
  AMBA: "Ambarella", MBLY: "Mobileye", TSLA: "Tesla", NXPI: "NXP", QCOM: "Qualcomm 高通",
  PLTR: "Palantir", PANW: "Palo Alto", CRWD: "CrowdStrike", MSFT: "Microsoft",
  AVAV: "AeroVironment", LMT: "Lockheed Martin",
  INTC: "Intel", GOOGL: "Alphabet 谷歌", AAPL: "Apple", FLEX: "Flex 偉創力",
  NOW: "ServiceNow", NET: "Cloudflare",
  ASTS: "AST SpaceMobile", RKLB: "Rocket Lab", SPCX: "SpaceX",
  PL: "Planet Labs", LUNR: "Intuitive Machines", RDW: "Redwire", KTOS: "Kratos",
  LILMF: "Lilium", JOBY: "Joby Aviation", ACHR: "Archer Aviation", EH: "EHang",
  PLUG: "Plug Power", BE: "Bloom Energy", BLDP: "Ballard Power",
  SE: "Sea Limited 冬海", GRAB: "Grab Holdings", MELI: "MercadoLibre",
  SNOW: "Snowflake", DDOG: "Datadog",
};

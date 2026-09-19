# 双拼方案扩展（小鹤/搜狗）与语音权限弹窗就地化

2026-09 第二批：① 权限弹窗不跳设置界面；② 小鹤/搜狗双拼 + 键位图挪设置页；
③ 说完了按钮缩小；④ 空格键长按角标。对应验收点见发布页。

## 1. 语音权限弹窗就地弹出

VoicePermissionActivity 未声明 taskAffinity，默认继承包名；Service 以
FLAG_ACTIVITY_NEW_TASK 启动时复用了同包 SetupActivity 的任务栈，把输入法
设置界面顶到前台，打断输入流。修复：`android:taskAffinity=""`（独立空任务，
透明主题下用户当前界面保持可见），intent 加 FLAG_ACTIVITY_NO_ANIMATION。
excludeFromRecents/finishOnTaskLaunch 维持；仍不用 noHistory（权限回调
可靠性，见 userdata.md §2）。

## 2. 双拼方案：小鹤 / 搜狗

### 2.1 键位数据（权威来源）

- 自然码：现役 ziranma_double_pinyin（historical misnomer 已正名，algebra 不动）。
- 小鹤：rime 上游 double_pinyin_flypy 的 speller algebra 逐字搬运
  （iu=Q ei=W uan=R ue=T un=Y uo=O ie=P ong/iong=S ing/uai=K ai=D en=F
  eng=G uang/iang=L ang=H ian=M an=J ou=Z ia/ua=X iao=N ao=C ui=V in=B，
  zh=V ch=I sh=U；零声母=首字母双写，全拼形态同样入 prism）。
  deliberate diff：激活 `abbrev/^(.).+$/$1/`（上游注释掉，自然码在用，
  首键出候选）。上游 xlit 两侧都是 24 字符（不含 A/E），曾错抄成 25/26
  导致 R→e 级联全错——xlit 必须逐位核对，改完必须重编。
- 搜狗：上游 double_pinyin_mspy 的 algebra 逐字搬运（搜狗与微软双拼同族）：
  Q iu W ia/ua R er/uan T ue/üe Y uai/ü S iong/ong D iang/uang J an K ao
  L ai Z ei X ie C iao V zh/ui B ou N in M ian，`;`=ing，
  零声母=固定 O + 韵母键（啊=oa、爱=ol、昂=oh、二=or）。
  唯一裁剪：去掉 `derive/T$/V/`（üe 借道 V 的别名打法），避免生成键位图时
  一个韵母命中两键；V 键保持 ui+zh 的图表原貌。initials 排除 `;`，
  防止 ing 键落在句首被当声母。abbrev 单键行与自然码一致（首键出候选）。
- 搜狗的分词/隔音：双拼定长两键天然定界，零声母由 O 承担，`'` 分隔符无
  实际用途——宽键位改为「ing」（emit `;`），不再放分词键。

### 2.2 构建链

original-schemas/ 手写源 → build-cmake-native-engines.sh 用 host
rime_deployer --build 编 prism.bin/txt → schema+prism 拷入 assets →
MANIFEST.json 登记（hash 校验部署）。本机可用 ~/tmp/pinned 的缓存
deployer 直编（shared+opencc+user/default.custom.yaml schema_list）；
prism.txt 由 dump 脚本按 algebra 展开（spelling/syllable 两列是 golden
消费方唯一读取的列；类型/权重列按编译出的 .bin 实际值填：全两键拼式
normal/0，一键缩写 abbrev/-0.693147）。ziranma 用同管线重编结果与
shipped 逐字节一致，两新方案源（original-schemas）重编也与 assets 一致。

### 2.3 引擎与设置

- prefs `feelime_engine.dp_scheme`（DoublePinyinScheme 单例）：ziranma（默认）/
  flypy / sogou / ziguang；未知 id 回落 ziranma。
- 紫光（issue #16，1.0.18/键盘 3.46.0）：algebra 逐条转写自雾凇拼音
  rime-frost 的 ziguang schema（圆圈中间字母→大写字母，等价性由 spell()
  全音节对照自证 + 独立复核双重验证）。键位 en=W eng=T in/uai=Y zh=U sh=I
  uo=O ai=P ch=A iang/uang=G ang=S ie=D ian=F ong/iong=H er/iu=J ei=K
  uan=L ing=`;` ou=Z ia/ua=X iao=B ue/ui/üe=N un=M ao=Q an=R，零声母
  =O+韵母键（xform，无全拼形态），ü 在 V。宽键形态与 sogou 同（ing 发 `;`）。
  生成器边界：N 键三韵母折叠显示「ui üe」；C 键无韵母不出格。
  微软双拼与搜狗键位一致（上游同为 mspy），不单独加方案：label 改
  「搜狗 / 微软」。
- EngineFactory.DOUBLE_PINYIN 按该 pref 选 schema id；
  isModeReady(DOUBLE_PINYIN) 按同一 schema 文件判断。
- 设置页「键盘与输入 → 双拼方案」四选一（state.dpScheme +
  setDoublePinyinScheme，BAD_DP_SCHEME 报错事件）。切换后桥接层广播
  ACTION_DP_SCHEME_CHANGED：IME 若正处于双拼会话则 recreateEngineSession
  换 schema（同词库换入的卡点位），随后重推 hello；非双拼会话下次建会话
  自然取新值。
- 已知限制（与 userdata 词库换入同款时序）：recreateEngineSession 异步
  重建期间键入的键会被旧会话以 STALE_STAMP 拒绝（丢键窗口，1.0.5 不改
  coordinator 排队语义）；hello 先于新会话就绪，键盘已显示新方案但仍可能
  吞掉切换瞬间的一两键。
- hello 新增 dpScheme；键盘侧用 own-property 白名单校验，未知 id 回落
  ziranma。变体重放的 `;` 键码需原生 setComposition 校验放行
  （BridgeContract.isValidComposition，与 `'` 同列合法键码）。

### 2.4 键盘与键位图

- generate-keyboard-data.py 对四个 schema（自然码/小鹤/搜狗/紫光）各产出两份生成物：
  keyboard.js 的 DP_INITIAL_FINALS（首键→第二键解析变体表，golden 测试
  逐方案对着 prism 校验），settings/dp-data.js 的键位图（settings 页是
  APK 资产，不经 keyboard 更新包的 4 文件白名单）。键位图行序
  10/9/`;zxcvbnm`——`;` 在第三行行首，对应宽键真实位置。
- 键盘按 hello 的 dpScheme 取变体表并切换宽键形态：ziranma/flypy =
  分词（emit `'`），sogou/ziguang = ing（emit `;`）。未知 id 回落自然码。
- 键盘快捷面板的「双拼键位」入口移除；键位图搬到设置页双拼方案卡片，
  随方案选择即时重画（声母/零声母说明逐方案 i18n）。

## 3. 说完了按钮

44px 高/78% 宽的实心大按钮视觉过重（用户反馈不协调），缩小至与卡片
内容比例协调（36px 高、约 60% 宽、字号 14），以预览截图定稿。

## 4. 空格键长按角标

复用 design §1.2 的 data-lp 圆点机制：#spaceKey 加 data-lp="voice-hold"，
右上角 4px 圆点标识长按语音。空格属「长按打开隐藏浮层」类，符合既有
「仅隐藏面/状态键带点」的噪声约束。

// UI
function uiAddOrReplace(type) { saveHistory(); if (activeComp) activeComp.replaceType(type); else { const w = toWorld(canvas.width/2, canvas.height/3); components.push(new Component(type, w.x-45, w.y-30)); } rebuildSimIndex(); }
function uiAddDynamic(type) { let n = parseInt(prompt("引脚数量 (2-16):", "4")); if (isNaN(n) || n < 2 || n > 16) return; saveHistory(); if (activeComp) { activeComp.customN = n; activeComp.replaceType(type); } else { const w = toWorld(canvas.width/2, canvas.height/3); components.push(new Component(type, w.x-45, w.y-30, null, n)); } rebuildSimIndex(); }
function toggleSelectMode() { isSelectMode = !isSelectMode; const btn = document.getElementById('selBtn'); btn.innerText = isSelectMode ? "🔲 选择 [ON]" : "🔲 选择 [OFF]"; btn.className = isSelectMode ? "active" : ""; if (!isSelectMode) multiSelectedComps = []; }
function downloadProject() { const data = JSON.stringify({ components, wires, nextId }, null, 2); const blob = new Blob([data], { type: 'application/json' }); const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `logic-v75.json`; a.click(); }
function handleFileSelect(e) { const reader = new FileReader(); reader.onload = (ev) => { const d = JSON.parse(ev.target.result); components = d.components.map(x => { let c = new Component(x.type, x.x, x.y, x.id, x.customN); Object.assign(c, x); ensurePinsConsistency(c); return c; }); wires = d.wires; nextId = d.nextId; rebuildSimIndex(); }; reader.readAsText(e.target.files[0]); }
function openWorkshop() {
    fetch("/list")
        .then(res => res.json())
        .then(files => renderWorkshopList(files))
        .catch(err => alert("获取列表失败: " + err));
}

function renderWorkshopList(files) {
    const list = document.getElementById("workshopList");
    list.innerHTML = "";

    files.forEach(name => {
        const btn = document.createElement("button");
        btn.innerText = name;
        btn.onclick = () => loadFromServer(name);
        list.appendChild(btn);
    });

    document.getElementById("workshopModal").style.display = "flex";
}

// function loadFromServer(name) {
//     fetch(`http://localhost:5000/load/${name}`)
//         .then(res => res.json())
//         .then(d => {
//             components = d.components;
//             wires = d.wires || [];
//             nextId = d.nextId || 1;
//             rebuildSimIndex();
//             alert("载入成功");
//         })
//         .catch(err => alert("加载失败: " + err));
// }

function loadFromServer(name) {
    fetch(`/load/${name}`)
        .then(res => res.json())
        .then(d => {
            saveHistory();
            components = d.components.map(x => {
                let c = new Component(x.type, x.x, x.y, x.id, x.customN);
                Object.assign(c, x);
                ensurePinsConsistency(c);
                return c;
            });

            wires = d.wires || [];
            nextId = d.nextId || Math.max(0, ...components.map(c=>c.id)) + 1;
            rebuildSimIndex();

            alert("载入成功");
        })
        .catch(err => alert("加载失败: " + err));
}

function openUploadModal() {
    document.getElementById("uploadModal").style.display = "flex";
}

function closeUploadModal() {
    document.getElementById("uploadModal").style.display = "none";
}

function closeWorkshop() {
    document.getElementById("workshopModal").style.display = "none";
}

async function uploadProject() {
    const title = document.getElementById("uploadTitle").value.trim();
    const fileInput = document.getElementById("uploadFile");

    if (!title) {
        alert("请输入标题");
        return;
    }

    if (fileInput.files.length === 0) {
        alert("请选择文件");
        return;
    }

    const file = fileInput.files[0];

    const reader = new FileReader();

    reader.onload = async (e) => {
        try {
            const content = e.target.result;

            const res = await fetch("/upload", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({
                    name: title + ".json",
                    data: JSON.parse(content)
                })
            });

            if (!res.ok) throw new Error("上传失败");

            alert("✅ 上传成功");

            closeUploadModal();

        } catch (err) {
            alert("❌ 上传失败: " + err.message);
        }
    };

    reader.readAsText(file);
}

function openHelp() {
    document.getElementById("help").style.display = "flex";
}

function closeHelp() {
    document.getElementById("help").style.display = "none";
}

function saveHistory() { history.push(JSON.stringify({ components, wires, nextId })); if (history.length > 20) history.shift(); }
function undo() { if (history.length > 0) { const d = JSON.parse(history.pop()); components = d.components.map(x => { let c = new Component(x.type, x.x, x.y, x.id, x.customN); Object.assign(c, x); ensurePinsConsistency(c); return c; }); wires = d.wires; nextId = d.nextId; rebuildSimIndex(); } }
function clearCanvas() { if(confirm("确认清空？")){ saveHistory(); components=[]; wires=[]; multiSelectedComps=[]; rebuildSimIndex(); } }

let aiConfig = {
    apiKey: localStorage.getItem("apiKey") || "tp-ccj0lr6vbh5o8x8a1bs9o29yxxj2bfd5w4a8k7mjzay6td8a",
    apiUrl: localStorage.getItem("apiUrl") || "https://token-plan-cn.xiaomimimo.com/v1/chat/completions"
};

// 打开侧边栏
document.getElementById("aiToggleBtn").onclick = toggleAISidebar;

function toggleAISidebar() {
    const bar = document.getElementById("aiSidebar");
    bar.classList.toggle("open");
}

// 打开配置
function openAIConfig() {
    document.getElementById("aiConfigModal").style.display = "flex";
}

function closeAIConfig() {
    document.getElementById("aiConfigModal").style.display = "none";
}

// 保存API
function saveAIConfig() {
    aiConfig.apiKey = document.getElementById("apiKeyInput").value;
    aiConfig.apiUrl = document.getElementById("apiUrlInput").value;

    localStorage.setItem("apiKey", aiConfig.apiKey);
    localStorage.setItem("apiUrl", aiConfig.apiUrl);

    closeAIConfig();
    alert("配置已保存！");
}

// 发送消息
async function sendAIMessage() {


    const input = document.getElementById("aiInput");
    const text = input.value.trim();

    if (!text) return;

    addMessage("user", text);
    input.value = "";

    const loadingMsg = addMessage("ai", "思考中...");

    try {
        const res = await fetch(aiConfig.apiUrl || "https://mobaohee.xyz/v1/chat/completions", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": "Bearer " + aiConfig.apiKey
            },
            body: JSON.stringify({
                model: "mimo-v2.5-pro",
                messages: [
                    {
                        role: "system",
                        content: "你是一个数字电路专家，用户会提供电路结构，请分析其逻辑功能并回答问题。"
                    },
                    {
                        role: "user",
                        content: `
用户问题：
${text}

当前电路（JSON）：
${JSON.stringify(getCircuitDataLite(), null, 2)}

电路连接关系：
${getCircuitSummary()}
                        `
                    }
                ],
                temperature: 0.7
            })
        });

        if (!res.ok) {
            throw new Error("HTTP " + res.status);
        }

        const data = await res.json();
        const reply = data.choices?.[0]?.message?.content || "⚠️ 无返回";

        loadingMsg.innerText = reply;

    } catch (err) {
        loadingMsg.innerText = "❌ 请求失败：" + err.message;
    }
}

// 添加消息
function addMessage(role, text) {
    const box = document.getElementById("aiChatBox");
    const div = document.createElement("div");
    div.className = "ai-msg " + role;
    div.innerText = text;
    box.appendChild(div);
    box.scrollTop = box.scrollHeight;
    return div; // ⭐关键：返回节点
}

function getCircuitDataLite() {
    return {
        components: components.map(c => ({
            id: c.id,
            type: c.type
        })),
        wires: wires.map(w => ({
            from: w.fromId,
            to: w.toId
        }))
    };
}

function getCircuitSummary() {
    let map = {};
    components.forEach(c => {
        map[c.id] = c.type;
    });

    let lines = wires.map(w => {
        return `${map[w.fromId]}(${w.fromId}) -> ${map[w.toId]}(${w.toId})`;
    });

    return lines.join("\n");
}

async function generateCircuitFromAI(userText) {
    const loadingMsg = addMessage("ai", "正在生成电路...");

    try {
        const res = await fetch(aiConfig.apiUrl || "https://mobaohee.xyz/v1/chat/completions", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": "Bearer " + aiConfig.apiKey
            },
            body: JSON.stringify({
                model: "mimo-v2.5-pro",
                messages: [
                    {
                        role: "system",
                        content: `
你是一个数字电路生成器。

必须输出严格 JSON，禁止任何解释、注释、说明、代码块（包括 // 或 \`\`\`）。

输出格式：
{
  "components": [
    { "id": 1, "type": "SWITCH" }
  ],
  "wires": [
    { "from": 1, "to": 2, "toPin": 0 }
  ]
}

====================
【元件类型支持】

基础逻辑：
SWITCH, CLOCK, LIGHT
AND, OR, NOT, XOR

组合逻辑：
HA（半加器）
FA（全加器）
MUX（2选1）
MUX4（4选1）

时序逻辑：
DFF, JKFF, TFF, CNT4

扩展：
SEG7, SEG8
DEC24, DEC38
ENC42

====================
【引脚规则（非常重要）】

SWITCH:
- 输出: 1

LIGHT:
- 输入: 1 (toPin=0)

NOT:
- 输入: 1 (toPin=0)

AND / OR / XOR:
- 输入: 2 (toPin=0,1)

HA（半加器）:
- 输入: A(0), B(1)
- 输出: SUM(0), CARRY(1)

FA（全加器）:
- 输入: A(0), B(1), CIN(2)
- 输出: SUM(0), COUT(1)

MUX（2选1）:
- 输入: D0(0), D1(1), SEL(2)
- 输出: Y(0)

MUX4（4选1）:
- 输入: D0~D3(0~3), S0(4), S1(5)
- 输出: Y(0)

DFF:
- 输入: D(0), CLK(1), EN(2)
- 输出: Q(0)

JKFF:
- 输入: J(0), K(1), CLK(2), EN(3)
- 输出: Q(0), Q'(1)

TFF:
- 输入: T(0), CLK(1), EN(2)
- 输出: Q(0), Q'(1)

CNT4:
- 输入: CLK(0), RST(1), EN(2)
- 输出: Q0~Q3(0~3), TC(4)

====================
【严格规则】

1. id 必须从 1 递增
2. wires:
   - from = 输出元件 id
   - to = 输入元件 id
   - toPin 必须正确
3. 不允许省略 toPin
4. 不允许出现未定义 type
5. 不允许解释文本
6. 不允许注释（//）

====================
【目标】

根据用户需求生成完整可连接电路。

例如：
“4bit加法器” → 使用 FA 级联
“寄存器” → 使用 DFF
`
                    },
                    {
                        role: "user",
                        content: userText
                    }
                ],
                temperature: 0.2
            })
        });

        if (!res.ok) throw new Error("HTTP " + res.status);

        const data = await res.json();
        let text = data.choices?.[0]?.message?.content || "";

        // 🔥 去掉可能的 ```json 包裹
        text = text.replace(/```json|```/g, "").trim();

        const json = JSON.parse(text);

        // ✅ 就加在这里
        if (!validateCircuit(json)) {
            throw new Error("AI返回格式错误");
        }

        // ✅ 2. 自动分配引脚（⭐就是这里）
        json.wires = autoAssignPins(json.wires);

        // ✅ 3. 保存结果
        window.__aiGeneratedCircuit = json;

        // ✅ 4. 显示按钮
        showApplyButton();

        loadingMsg.innerText = "✅ 电路已生成，点击应用";

        // 👉 保存结果
        window.__aiGeneratedCircuit = json;

        showApplyButton();

    } catch (err) {
        loadingMsg.innerText = "❌ 生成失败：" + err.message;
    }
}

function showApplyButton() {
    let btn = document.getElementById("applyAIBtn");

    if (!btn) {
        btn = document.createElement("button");
        btn.id = "applyAIBtn";
        btn.innerText = "⚡ 应用AI电路";
        btn.style.display = "inline-block";

        btn.onclick = applyAICircuit;

        const footer = document.querySelector(".ai-footer");

        // ⭐ 插到“配置API按钮”旁边
        const configBtn = footer.querySelector("button");

        footer.insertBefore(btn, configBtn.nextSibling);
    }
}

function applyAICircuit() {
    const data = window.__aiGeneratedCircuit;
    if (!data) return alert("没有可用电路");

    // 🔥 创建组件（完全走你的init逻辑）
    const newComponents = data.components.map((c, i) => {
        const comp = new Component();   // ⚠️ 用你原类
        comp.init(c.type, 300 + i * 120, 300);
        comp.id = c.id;
        return comp;
    });

    // 🔥 建立ID映射
    const map = {};
    newComponents.forEach(c => map[c.id] = c);

    // 🔥 生成连线（关键升级）
    const newWires = data.wires.map(w => ({
        fromId: w.from,
        fromNodeIdx: 0,  // 默认输出0
        toId: w.to,
        toNodeIdx: w.toPin || 0
    }));

    // 🔥 应用
    components = newComponents;
    wires = newWires;
    nextId = newComponents.length + 1;
    alert("✅ AI电路已应用");
}

function validateCircuit(data) {
    return data.components && data.wires;
}

function autoAssignPins(wires) {
    const countMap = {};

    wires.forEach(w => {
        if (w.toPin !== undefined) return; // ✅ 已有就不动

        const key = w.to;
        if (!countMap[key]) countMap[key] = 0;

        w.toPin = countMap[key]++;
    });

    return wires;
}

function generateFromInput() {
    const input = document.getElementById("aiInput");
    const text = input.value.trim();

    if (!text) return;

    // ✅ 显示用户消息
    addMessage("user", text);

    // ✅ 清空输入框
    input.value = "";

    // ✅ 调用AI生成
    generateCircuitFromAI(text);
}
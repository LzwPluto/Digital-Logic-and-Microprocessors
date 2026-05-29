// 核心渲染与逻辑
let useDarkBackground = false; 

const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d', { alpha: false });
canvas.width = window.innerWidth; canvas.height = window.innerHeight;

let scale = 1.0, offsetX = 0, offsetY = 0;
let components = [], wires = [], history = [];
let selectedNode = null, draggingComp = null, activeComp = null;
let lastTap = 0, nextId = 1, lastPinchDist = null;
let isSelectMode = false, selectionStart = null, selectionRect = null, multiSelectedComps = [];

// 时钟与系统控制
let globalClockInterval = 20;
let isSimRunning = true;
function updateClockSpeed(val) { globalClockInterval = parseInt(val); document.getElementById('clockVal').innerText = val; }
function toggleSim() {
    isSimRunning = !isSimRunning;
    const btn = document.getElementById('pauseBtn');
    if (isSimRunning) { btn.innerText = "⏸ 暂停"; btn.className = ""; }
    else { btn.innerText = "▶ 运行"; btn.className = "active"; }
}
function resetView() { scale = 1.0; offsetX = 0; offsetY = 0; }

let lastTouchX = 0, lastTouchY = 0;
let SUB_STEPS = 12;

// 配置
const CONFIG = {
    'AND': [2, 1], 'OR': [2, 1], 'NOT': [1, 1], 'XOR': [2, 1],
    'SWITCH': [0, 1], 'CLOCK': [0, 1], 'LIGHT': [1, 0],
    'HA': [2, 2], 'FA': [3, 2], 'MUX': [3, 1], 'MUX4': [6, 1],
    'DFF': [3, 1], 'JKFF': [4, 2], 'TFF': [3, 2], 'SEG7': [7, 0], 'SEG8': [8, 0],
    'DEC24': [2, 4], 'DEC38': [3, 8], 'ENC42': [4, 3],
    'REGBANK': [4, 16], 'ROM16': [4, 16], 'CNT4': [3, 5]
};

let compMap = new Map(); let compiledWires = [];

function ensurePinsConsistency(comp) {
    const targetConfig = CONFIG[comp.type]; if (!targetConfig) return;
    const [expectedIn, expectedOut] = targetConfig;
    if (!comp.inputs || comp.inputs.length !== expectedIn) {
        const oldInputs = comp.inputs || [];
        const newInputs = new Array(expectedIn).fill(false);
        for (let i = 0; i < Math.min(oldInputs.length, expectedIn); i++) newInputs[i] = oldInputs[i];
        comp.inputs = newInputs;
    }
    if (!comp.outputs || comp.outputs.length !== expectedOut) {
        const oldOutputs = comp.outputs || [];
        const newOutputs = new Array(expectedOut).fill(false);
        for (let i = 0; i < Math.min(oldOutputs.length, expectedOut); i++) newOutputs[i] = oldOutputs[i];
        comp.outputs = newOutputs;
        if (!comp.frameStartOutputs || comp.frameStartOutputs.length !== expectedOut) comp.frameStartOutputs = new Array(expectedOut).fill(false);
        else { comp.frameStartOutputs.length = expectedOut; comp.frameStartOutputs.fill(false); }
    }
    if (['DFF', 'JKFF', 'TFF', 'CNT4'].includes(comp.type)) {
        if (typeof comp.state === 'undefined') comp.state = (comp.type === 'CNT4') ? 0 : false;
        if (typeof comp.lastClk === 'undefined') comp.lastClk = false;
    }
    if ((comp.type === 'REGBANK' || comp.type === 'ROM16') && (!comp.state || comp.state.length !== 16)) comp.state = new Array(16).fill(0);
    if (comp.type === 'SCOPE' && !comp.historyData) comp.historyData = [[], [], [], []];
}

function rebuildSimIndex() {
    compMap.clear();
    components.forEach(c => { ensurePinsConsistency(c); compMap.set(c.id, c); });
    compiledWires = wires.map(w => ({
        source: compMap.get(w.fromId), target: compMap.get(w.toId),
        fromIdx: w.fromNodeIdx, toIdx: w.toNodeIdx
    })).filter(w => w.source && w.target);
}

function toWorld(screenX, screenY) { return { x: (screenX - offsetX) / scale, y: (screenY - offsetY) / scale }; }

class Component {
    constructor(type, x, y, id = null, customN = null) {
        this.id = id || nextId++; this.customN = customN; this.init(type, x, y);
    }
    init(type, x, y) {
        this.type = type; this.x = x; this.y = y;
        let inCount, outCount;
        if (type === 'AND_N' || type === 'OR_N') { inCount = this.customN || 4; outCount = 1; }
        else if (type === 'SCOPE') { inCount = 4; outCount = 0; }
        else { [inCount, outCount] = CONFIG[type] || [0, 0]; }

        this.w = (type === 'SEG7') ? 70 : (type === 'SEG8' ? 100 : ((type === 'REGBANK' || type === 'ROM16') ? 120 : (type === 'SCOPE' ? 240 : 90)));
        const maxPins = Math.max(inCount, outCount);
        this.h = (type === 'SEG7' || type === 'SEG8') ? 100 : ((type === 'REGBANK' || type === 'ROM16') ? 340 : (type === 'SCOPE' ? 120 : (maxPins > 3 ? 20 + maxPins * 20 : 60)));

        this.inputs = new Array(inCount).fill(false); this.outputs = new Array(outCount).fill(false); this.frameStartOutputs = new Array(outCount).fill(false);

        if (type === 'REGBANK' || type === 'ROM16') this.state = new Array(16).fill(0);
        else if (['DFF', 'JKFF', 'TFF'].includes(type)) { this.state = false; this.lastClk = false; }
        else if (type === 'CNT4') { this.state = 0; this.lastClk = false; }
        else this.state = 0;

        if (type === 'SCOPE') this.historyData = [[], [], [], []];
        this.timer = 0;
    }
    replaceType(newType) { this.init(newType, this.x, this.y); rebuildSimIndex(); }

    updateLogic(isFirstSubStep) {
        const inp = this.inputs;
        switch (this.type) {
            case 'AND': this.outputs[0] = inp[0] && inp[1]; break;
            case 'OR': this.outputs[0] = inp[0] || inp[1]; break;
            case 'AND_N': this.outputs[0] = inp.every(v => v); break;
            case 'OR_N': this.outputs[0] = inp.some(v => v); break;
            case 'NOT': this.outputs[0] = !inp[0]; break;
            case 'XOR': this.outputs[0] = inp[0] !== inp[1]; break;
            case 'SWITCH': this.outputs[0] = !!this.state; break;
            case 'CLOCK':
                if (isFirstSubStep && isSimRunning) { this.timer++; if (this.timer >= globalClockInterval) { this.state = !this.state; this.timer = 0; } }
                this.outputs[0] = !!this.state; break;
            case 'HA': this.outputs[0] = inp[0] !== inp[1]; this.outputs[1] = inp[0] && inp[1]; break;
            case 'FA': const s1 = inp[0] !== inp[1]; this.outputs[0] = s1 !== inp[2]; this.outputs[1] = (inp[0] && inp[1]) || (inp[2] && s1); break;
            case 'MUX': this.outputs[0] = inp[2] ? inp[1] : inp[0]; break;
            case 'MUX4': this.outputs[0] = inp[(inp[5] ? 2 : 0) + (inp[4] ? 1 : 0)]; break;
            case 'DFF': {
                if (inp[2]) { this.state = false; } else if (inp[1] && !this.lastClk) {
                    let stD = inp[0]; const w = compiledWires.find(w => w.target === this && w.toIdx === 0);
                    if (w) stD = w.source.frameStartOutputs[w.fromIdx]; this.state = !!stD;
                }
                this.lastClk = inp[1]; this.outputs[0] = !!this.state; break;
            }
            case 'JKFF': {
                if (inp[3]) { this.state = false; } else if (inp[1] && !this.lastClk) {
                    let sJ = inp[0], sK = inp[2];
                    const wJ = compiledWires.find(w => w.target === this && w.toIdx === 0); const wK = compiledWires.find(w => w.target === this && w.toIdx === 2);
                    if (wJ) sJ = wJ.source.frameStartOutputs[wJ.fromIdx]; if (wK) sK = wK.source.frameStartOutputs[wK.fromIdx];
                    if (sJ && !sK) this.state = true; else if (!sJ && sK) this.state = false; else if (sJ && sK) this.state = !this.state;
                }
                this.lastClk = inp[1]; this.outputs[0] = !!this.state; this.outputs[1] = !this.state; break;
            }
            case 'TFF': {
                if (inp[2]) { this.state = false; } else if (inp[1] && !this.lastClk) {
                    let stT = inp[0]; const w = compiledWires.find(w => w.target === this && w.toIdx === 0);
                    if (w) stT = w.source.frameStartOutputs[w.fromIdx]; if (stT) this.state = !this.state;
                }
                this.lastClk = inp[1]; this.outputs[0] = !!this.state; this.outputs[1] = !this.state; break;
            }
            case 'CNT4': {
                const en = inp[0], clk = inp[1], rst = inp[2];
                if (rst) { this.state = 0; } else if (clk && !this.lastClk) {
                    let sEN = en; const w = compiledWires.find(w => w.target === this && w.toIdx === 0);
                    if (w) sEN = w.source.frameStartOutputs[w.fromIdx];
                    if (sEN) this.state = (this.state + 1) & 0xF;
                }
                this.lastClk = clk;
                for (let i = 0; i < 4; i++) this.outputs[i] = !!((this.state >> i) & 1);
                this.outputs[4] = (this.state === 15 && en); break; // COUT
            }
            case 'DEC24': this.outputs.fill(false); this.outputs[(inp[1] ? 2 : 0) + (inp[0] ? 1 : 0)] = true; break;
            case 'DEC38': this.outputs.fill(false); this.outputs[(inp[2] ? 4 : 0) + (inp[1] ? 2 : 0) + (inp[0] ? 1 : 0)] = true; break;
            case 'ENC42':
                if (inp[3]) { this.outputs[0] = true; this.outputs[1] = true; this.outputs[2] = true; }
                else if (inp[2]) { this.outputs[0] = true; this.outputs[1] = false; this.outputs[2] = true; }
                else if (inp[1]) { this.outputs[0] = false; this.outputs[1] = true; this.outputs[2] = true; }
                else if (inp[0]) { this.outputs[0] = false; this.outputs[1] = false; this.outputs[2] = true; }
                else { this.outputs.fill(false); } break;
            case 'LIGHT': this.state = inp[0]; break;
            case 'SEG8':
                let val = 0; for (let i = 0; i < 8; i++) if (inp[i]) val += Math.pow(2, i);
                if (inp[7]) val -= 256; this.state = val; break;
            case 'REGBANK': case 'ROM16':
                let sel = (inp[3] ? 8 : 0) + (inp[2] ? 4 : 0) + (inp[1] ? 2 : 0) + (inp[0] ? 1 : 0);
                let regVal = this.state[sel] || 0;
                for (let i = 0; i < 16; i++) this.outputs[i] = !!((regVal >> i) & 1); break;
            case 'SCOPE':
                if (isFirstSubStep && isSimRunning) {
                    for (let i = 0; i < 4; i++) { this.historyData[i].push(inp[i]); if (this.historyData[i].length > 100) this.historyData[i].shift(); }
                } break;
        }
    }

    draw() {
        let bodyColor = '#252526';
        if (this.type === 'LIGHT') bodyColor = this.state ? '#d7ba7d' : '#2d2d2d';
        else if (this.type === 'SWITCH' || this.type === 'CLOCK') bodyColor = this.state ? '#c74646' : '#2d2d2d';
        else if (this.type === 'SCOPE') bodyColor = '#111';
        else if (this.type === 'ROM16') bodyColor = '#1e2b3c';

        ctx.fillStyle = bodyColor;
        ctx.beginPath(); ctx.roundRect(this.x, this.y, this.w, this.h, 2); ctx.fill();

        if (activeComp === this || multiSelectedComps.includes(this)) { ctx.strokeStyle = '#007acc'; ctx.lineWidth = 2 / scale; }
        else { ctx.strokeStyle = '#3e3e42'; ctx.lineWidth = 1.5 / scale; }
        ctx.stroke();

        if (this.type === 'SCOPE') {
            ctx.fillStyle = '#000'; ctx.fillRect(this.x + 10, this.y + 10, this.w - 40, this.h - 20);
            ctx.strokeStyle = '#222'; ctx.lineWidth = 1 / scale; ctx.beginPath();
            for (let i = 1; i < 4; i++) { ctx.moveTo(this.x + 10, this.y + 10 + i * (this.h - 20) / 4); ctx.lineTo(this.x + this.w - 30, this.y + 10 + i * (this.h - 20) / 4); } ctx.stroke();
            ctx.font = '10px Consolas'; ctx.textAlign = 'right';
            const colors = ['#c74646', '#569cd6', '#4ec9b0', '#d7ba7d'];
            for (let i = 0; i < 4; i++) { ctx.fillStyle = colors[i]; ctx.fillText(`CH${i}`, this.x + this.w - 5, this.y + 25 + i * 25); }
            if (this.historyData) {
                for (let i = 0; i < 4; i++) {
                    ctx.strokeStyle = colors[i]; ctx.lineWidth = 1.5 / scale; ctx.beginPath();
                    for (let t = 0; t < this.historyData[i].length; t++) {
                        let val = this.historyData[i][t]; let px = this.x + 10 + (t / 100) * (this.w - 40); let py = this.y + 10 + (i * 25) + (val ? 4 : 21);
                        if (t === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
                    } ctx.stroke();
                }
            }
            this.drawPins(); return;
        }

        if (this.type === 'REGBANK' || this.type === 'ROM16') {
            ctx.fillStyle = '#d4d4d4'; ctx.font = 'bold 12px Consolas'; ctx.textAlign = 'center';
            ctx.fillText(this.type === 'ROM16' ? "ROM 16x16" : "REG BANK 16", this.x + this.w / 2, this.y + 15);
            let selIdx = (this.inputs[3] ? 8 : 0) + (this.inputs[2] ? 4 : 0) + (this.inputs[1] ? 2 : 0) + (this.inputs[0] ? 1 : 0);
            ctx.font = '10px Consolas';
            for (let i = 0; i < 16; i++) {
                let ry = this.y + 20 + i * 20;
                if (i === selIdx) { ctx.fillStyle = this.type === 'ROM16' ? '#005f5f' : '#007acc'; ctx.fillRect(this.x + 5, ry + 2, this.w - 10, 16); }
                ctx.fillStyle = (i === selIdx) ? '#fff' : '#858585';
                ctx.textAlign = 'left'; ctx.fillText((this.type === 'ROM16' ? "A" : "R") + i.toString(16).toUpperCase() + ":", this.x + 10, ry + 14);
                let hexStr = '0x' + this.state[i].toString(16).padStart(4, '0').toUpperCase();
                ctx.textAlign = 'right'; ctx.fillText(hexStr, this.x + this.w - 10, ry + 14);
            }
            this.drawPins(); return;
        }

        ctx.fillStyle = (this.type === 'LIGHT' && this.state) ? '#000' : '#d4d4d4';
        ctx.font = 'bold 12px Consolas'; ctx.textAlign = 'center';
        let labelText = this.type;
        if (this.type === 'AND_N') labelText = `AND(${this.customN})`;
        if (this.type === 'OR_N') labelText = `OR(${this.customN})`;
        if (!['SEG8', 'JKFF', 'TFF', 'CNT4'].includes(this.type)) ctx.fillText(labelText, this.x + this.w / 2, this.y + this.h / 2 + 4);

        if (['DFF', 'JKFF', 'TFF', 'CNT4'].includes(this.type)) {
            ctx.fillStyle = '#858585'; ctx.font = '10px Consolas'; ctx.textAlign = 'left';
            if (this.type === 'DFF') {
                ctx.fillText('D', this.x + 10, this.y + this.h / 4 + 4); ctx.fillText('CLK', this.x + 10, this.y + 2 * this.h / 4 + 4); ctx.fillText('RST', this.x + 10, this.y + 3 * this.h / 4 + 4);
                ctx.textAlign = 'right'; ctx.fillText('Q', this.x + this.w - 10, this.y + this.h / 2 + 4);
            } else if (this.type === 'TFF') {
                ctx.fillText('T', this.x + 10, this.y + this.h / 4 + 4); ctx.fillText('CLK', this.x + 10, this.y + 2 * this.h / 4 + 4); ctx.fillText('RST', this.x + 10, this.y + 3 * this.h / 4 + 4);
                ctx.textAlign = 'right'; ctx.fillText('Q', this.x + this.w - 10, this.y + this.h / 3 + 4); ctx.fillText('~Q', this.x + this.w - 10, this.y + 2 * this.h / 3 + 4);
            } else if (this.type === 'JKFF') {
                ctx.fillText('J', this.x + 10, this.y + this.h / 5 + 4); ctx.fillText('CLK', this.x + 10, this.y + 2 * this.h / 5 + 4); ctx.fillText('K', this.x + 10, this.y + 3 * this.h / 5 + 4); ctx.fillText('RST', this.x + 10, this.y + 4 * this.h / 5 + 4);
                ctx.textAlign = 'right'; ctx.fillText('Q', this.x + this.w - 10, this.y + this.h / 3 + 4); ctx.fillText('~Q', this.x + this.w - 10, this.y + 2 * this.h / 3 + 4);
            } else if (this.type === 'CNT4') {
                ctx.fillText('EN', this.x + 10, this.y + this.h / 4 + 4); ctx.fillText('CLK', this.x + 10, this.y + 2 * this.h / 4 + 4); ctx.fillText('RST', this.x + 10, this.y + 3 * this.h / 4 + 4);
                ctx.textAlign = 'right'; ctx.fillText('Q0', this.x + this.w - 10, this.y + this.h / 6 + 4); ctx.fillText('Q1', this.x + this.w - 10, this.y + 2 * this.h / 6 + 4);
                ctx.fillText('Q2', this.x + this.w - 10, this.y + 3 * this.h / 6 + 4); ctx.fillText('Q3', this.x + this.w - 10, this.y + 4 * this.h / 6 + 4); ctx.fillText('COUT', this.x + this.w - 10, this.y + 5 * this.h / 6 + 4);
            }
        }

        if (this.type === 'SEG7') {
            const segs = [[20, 15, 30, 4], [50, 20, 4, 20], [50, 50, 4, 20], [20, 70, 30, 4], [16, 50, 4, 20], [16, 20, 4, 20], [20, 42, 30, 4]];
            segs.forEach((pos, i) => { ctx.fillStyle = this.inputs[i] ? '#f44336' : '#331111'; ctx.fillRect(this.x + pos[0], this.y + pos[1], pos[2], pos[3]); });
        }

        if (this.type === 'SEG8') {
            ctx.fillStyle = '#111'; ctx.fillRect(this.x + 10, this.y + 15, this.w - 20, this.h - 30);
            ctx.fillStyle = '#f44336'; ctx.font = 'bold 22px Consolas'; ctx.fillText(this.state, this.x + this.w / 2, this.y + this.h / 2 + 8);
            ctx.fillStyle = '#858585'; ctx.font = '9px Consolas'; ctx.fillText("8-BIT SIGNED", this.x + this.w / 2, this.y + this.h - 8);
        }

        this.drawPins();
    }

    drawPins() {
        ctx.fillStyle = '#4ec9b0';
        this.inputs.forEach((_, i) => {
            let px = this.x, py = this.y + (i + 1) * (this.h / (this.inputs.length + 1));
            if (this.type === 'REGBANK' || this.type === 'ROM16') { px = this.x + (i + 1) * (this.w / 5); py = this.y + this.h; }
            ctx.beginPath(); ctx.arc(px, py, 4, 0, Math.PI * 2); ctx.fill();
        });
        this.outputs.forEach((state, i) => {
            ctx.fillStyle = state ? '#c74646' : '#555';
            let outDiv = (this.type === 'REGBANK' || this.type === 'ROM16') ? 17 : (this.outputs.length + 1);
            ctx.beginPath(); ctx.arc(this.x + this.w, this.y + (i + 1) * (this.h / outDiv), 4, 0, Math.PI * 2); ctx.fill();
        });
    }
}

function processLogic() {
    for (let i = 0; i < components.length; i++) for (let j = 0; j < components[i].outputs.length; j++) components[i].frameStartOutputs[j] = components[i].outputs[j];
    for (let s = 0; s < SUB_STEPS; s++) {
        for (let i = 0; i < components.length; i++) components[i].inputs.fill(false);
        for (let i = 0; i < compiledWires.length; i++) {
            let w = compiledWires[i]; if (w.source.outputs[w.fromIdx]) w.target.inputs[w.toIdx] = true;
        }
        for (let i = 0; i < components.length; i++) components[i].updateLogic(s === 0);
    }
}


function toggleRaceMode() {
    const btn = document.getElementById('raceBtn');

    if (SUB_STEPS === 12) {
        // 关闭状态
        const msg = "⚠️ 警告：开启竞态模拟 (SUB_STEPS=1) 将暴露物理电路的门延迟、毛刺与竞争冒险现象。\n\n包含反馈环路的组合逻辑可能会发生剧烈震荡。是否确认开启？";
        if (confirm(msg)) {
            SUB_STEPS = 1;
            btn.innerText = "⚡ 竞态 [ON]";
            btn.classList.add("active");
            btn.classList.add("danger");
        }
    } else {
        // 开启状态
        const msg = "ℹ️ 提示：关闭竞态模拟将恢复多步迭代 (SUB_STEPS=12)。\n\n系统将强制电路在帧内收敛，掩盖瞬态毛刺，呈现理想的逻辑状态。";
        if (confirm(msg)) {
            SUB_STEPS = 12;
            btn.innerText = "⚡ 竞态 [OFF]";
            btn.classList.remove("active");
            btn.classList.remove("danger");
        }
    }
}

function toggleTheme() {
    useDarkBackground = !useDarkBackground;
    document.documentElement.classList.toggle('light');
    document.documentElement.classList.toggle('dark');
}

function loop() {

    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = useDarkBackground ? '#f5f5f5':'#1e1e1e';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.fillRect(0,0,canvas.width,canvas.height);
    processLogic();

    // 绘制网格背景
    ctx.save();

    // 应用视图变换
    ctx.translate(offsetX, offsetY);
    ctx.scale(scale, scale);

    ctx.strokeStyle = '#00ccff57';
    ctx.lineWidth = 1 / scale; 
    const gridSize = 20;

    const left = -offsetX / scale;
    const top = -offsetY / scale;
    const right = left + canvas.width / scale;
    const bottom = top + canvas.height / scale;

    // 对齐网格
    const startX = Math.floor(left / gridSize) * gridSize;
    const startY = Math.floor(top / gridSize) * gridSize;
    const endX = Math.ceil(right / gridSize) * gridSize;
    const endY = Math.ceil(bottom / gridSize) * gridSize;

    // 竖线
    for (let x = startX; x <= endX; x += gridSize) {
    ctx.beginPath();
    ctx.moveTo(x, top);
    ctx.lineTo(x, bottom);
    ctx.stroke();
    }

    // 横线
    for (let y = startY; y <= endY; y += gridSize) {
    ctx.beginPath();
    ctx.moveTo(left, y);
    ctx.lineTo(right, y);
    ctx.stroke();
    }

    ctx.restore();


    ctx.translate(offsetX, offsetY); ctx.scale(scale, scale);

    compiledWires.forEach(w => {
        const sig = w.source.outputs[w.fromIdx]; ctx.beginPath();
        let outDiv = (w.source.type === 'REGBANK' || w.source.type === 'ROM16') ? 17 : (w.source.outputs.length + 1);
        let startX = w.source.x + w.source.w, startY = w.source.y + (w.fromIdx + 1) * (w.source.h / outDiv);
        let endX = w.target.x, endY = w.target.y + (w.toIdx + 1) * (w.target.h / (w.target.inputs.length + 1));
        if (w.target.type === 'REGBANK' || w.target.type === 'ROM16') { endX = w.target.x + (w.toIdx + 1) * (w.target.w / 5); endY = w.target.y + w.target.h; }
        ctx.moveTo(startX, startY); ctx.lineTo(endX, endY);
        ctx.strokeStyle = sig ? '#c74646' : '#404040'; ctx.lineWidth = (sig ? 3 : 2) / scale; ctx.stroke();
    });

    components.forEach(c => c.draw());

    if (selectionRect) {
        ctx.fillStyle = 'rgba(0, 122, 204, 0.2)'; ctx.strokeStyle = '#007acc'; ctx.lineWidth = 1 / scale;
        ctx.fillRect(selectionRect.x, selectionRect.y, selectionRect.w, selectionRect.h); ctx.strokeRect(selectionRect.x, selectionRect.y, selectionRect.w, selectionRect.h);
    }
    requestAnimationFrame(loop);
}

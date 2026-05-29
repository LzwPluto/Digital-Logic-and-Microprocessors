
let editingTarget = null;
let lastMouseX = 0;
let lastMouseY = 0;
let lastMouseTap = 0;
let isMouseDown = false;
// 寄存器位编辑器逻辑
function openBitEditor(comp, idx) {
    editingTarget = {comp, idx};
    let val = comp.state[idx] || 0;
    document.getElementById('bitEditorTitle').innerText = comp.type === 'ROM16' 
        ? `配置 ROM 地址 0x${idx.toString(16).toUpperCase()}` 
        : `编辑寄存器 R${idx.toString(16).toUpperCase()}`;
    const grid = document.getElementById('bitGrid'); grid.innerHTML = '';
    
    for(let i=15; i>=0; i--) {
        let bitVal = (val >> i) & 1;
        let btn = document.createElement('div');
        btn.className = `bit-btn ${bitVal ? 'on' : ''}`;
        btn.innerHTML = `<span>B${i}</span><div class="val">${bitVal}</div>`;
        btn.onclick = function() {
            let isOn = this.classList.contains('on');
            this.classList.toggle('on', !isOn);
            this.querySelector('.val').innerText = isOn ? '0' : '1';
            updateBitEditorDisplay();
        };
        grid.appendChild(btn);
    }
    updateBitEditorDisplay();
    document.getElementById('bitEditorModal').style.display = 'flex';
}
function updateBitEditorDisplay() {
    let val = 0;
    document.querySelectorAll('#bitGrid .bit-btn').forEach((btn, index) => {
        if(btn.classList.contains('on')) val |= (1 << (15 - index));
    });
    document.getElementById('bitHexDisplay').innerText = '0x' + val.toString(16).padStart(4, '0').toUpperCase();
    document.getElementById('bitDecDisplay').innerText = val;
}
function closeBitEditor() { 

    document.getElementById('bitEditorModal').style.display = 'none';
    editingTarget = null;

    isMouseDown = false;
    draggingComp = null;
    selectionStart = null;
    selectionRect = null;
    lastPinchDist = null;

}
function saveBitEditor() {
    if(!editingTarget) return;
    let val = 0;
    document.querySelectorAll('#bitGrid .bit-btn').forEach((btn, index) => { if(btn.classList.contains('on')) val |= (1 << (15 - index)); });
    saveHistory(); editingTarget.comp.state[editingTarget.idx] = val; closeBitEditor();
}

// 触摸事件
canvas.addEventListener('touchstart', (e) => {
    e.preventDefault();
    const t1 = e.touches[0]; const world = toWorld(t1.clientX, t1.clientY);
    lastTouchX = t1.clientX; lastTouchY = t1.clientY;
    if (e.touches.length === 2) { lastPinchDist = Math.hypot(t1.clientX - e.touches[1].clientX, t1.clientY - e.touches[1].clientY); return; }
    let now = Date.now(); let isDBL = (now - lastTap < 300); lastTap = now; let clickedAny = false; const hitRadius = 20 / scale;
    for (let i = components.length - 1; i >= 0; i--) {
        let c = components[i];
        if (isDBL && world.x > c.x && world.x < c.x+c.w && world.y > c.y && world.y < c.y+c.h) {
            saveHistory(); wires = wires.filter(w => w.fromId!==c.id && w.toId!==c.id); components.splice(i, 1); rebuildSimIndex(); return;
        }
        for(let j=0; j<c.outputs.length; j++) {
            let outDiv = (c.type === 'REGBANK' || c.type === 'ROM16') ? 17 : (c.outputs.length+1);
            if (Math.hypot(world.x - (c.x + c.w), world.y - (c.y + (j+1)*(c.h/outDiv))) < hitRadius) { selectedNode = { fromId: c.id, fromNodeIdx: j }; return; }
        }
        for (let j = 0; j < c.inputs.length; j++) {
            let pinX = c.x, pinY = c.y + (j+1)*(c.h/(c.inputs.length+1));
            if (c.type === 'REGBANK' || c.type === 'ROM16') { pinX = c.x + (j+1)*(c.w/5); pinY = c.y + c.h; }
            if (Math.hypot(world.x - pinX, world.y - pinY) < hitRadius) {
                if (selectedNode && selectedNode.fromId !== c.id) {
                    saveHistory();

                    let hasWire = wires.some(w => 
                        w.fromId === selectedNode.fromId &&
                        w.fromNodeIdx === selectedNode.fromNodeIdx &&
                        w.toId === c.id &&
                        w.toNodeIdx === j
                    );

                    if (hasWire) {
                        wires = wires.filter(w => 
                            !(w.fromId === selectedNode.fromId &&
                            w.fromNodeIdx === selectedNode.fromNodeIdx &&
                            w.toId === c.id &&
                            w.toNodeIdx === j)
                        );
                    } else {
                        wires = wires.filter(w => !(w.toId === c.id && w.toNodeIdx === j));
                        wires.push({
                            fromId: selectedNode.fromId,
                            fromNodeIdx: selectedNode.fromNodeIdx,
                            toId: c.id,
                            toNodeIdx: j
                        });
                    }

                    rebuildSimIndex();
                }
                selectedNode = null;
                return;
            }

        }
        if (world.x > c.x && world.x < c.x+c.w && world.y > c.y && world.y < c.y+c.h) {
            if ((c.type === 'REGBANK' || c.type === 'ROM16') && (world.y - c.y) > 20 && (world.y - c.y) < 340) {
                let idx = Math.floor((world.y - c.y - 20) / 20);
                if (idx >= 0 && idx < 16) { 
                    openBitEditor(c, idx); 
                    clickedAny = true; 
                    break; 
                }
                
            } else if (c.type === 'SWITCH') { saveHistory(); c.state = !c.state; }
            draggingComp = c; activeComp = c; clickedAny = true; 
            components.push(components.splice(i, 1)[0]); rebuildSimIndex(); break;
        }
    }
    if (!clickedAny) { activeComp = null; if (isSelectMode) { selectionStart = { x: world.x, y: world.y }; multiSelectedComps = []; } }
}, { passive: false });

canvas.addEventListener('touchmove', (e) => {
    e.preventDefault(); const t1 = e.touches[0];
    if (e.touches.length === 2) {
        const t2 = e.touches[1];
        const dist = Math.hypot(t1.clientX - t2.clientX, t1.clientY - t2.clientY);
        if (lastPinchDist === null) lastPinchDist = dist;

        const oldScale = scale;

        const centerX = (t1.clientX + t2.clientX) / 2;
        const centerY = (t1.clientY + t2.clientY) / 2;

        const worldCenter = toWorld(centerX, centerY);

        const zoom = 1 + (dist / lastPinchDist - 1) * 0.6;
        scale = Math.min(Math.max(oldScale * zoom, 0.1), 4);


        offsetX = centerX - worldCenter.x * scale;
        offsetY = centerY - worldCenter.y * scale;

        lastPinchDist = dist;
    } else {

        const dx = t1.clientX - lastTouchX, dy = t1.clientY - lastTouchY;
        if (draggingComp) {
            if (multiSelectedComps.includes(draggingComp)) multiSelectedComps.forEach(c => { c.x += dx/scale; c.y += dy/scale; });
            else { draggingComp.x += dx/scale; draggingComp.y += dy/scale; }
        } else if (selectionStart) {
            const world = toWorld(t1.clientX, t1.clientY);
            selectionRect = { x: Math.min(selectionStart.x, world.x), y: Math.min(selectionStart.y, world.y), w: Math.abs(selectionStart.x - world.x), h: Math.abs(selectionStart.y - world.y) };
        } else { offsetX += dx; offsetY += dy; }
    }
    lastTouchX = t1.clientX; lastTouchY = t1.clientY;
}, { passive: false });

canvas.addEventListener('touchend', (e) => { 
    if (selectionRect) multiSelectedComps = components.filter(c => c.x > selectionRect.x && c.x + c.w < selectionRect.x + selectionRect.w && c.y > selectionRect.y && c.y + c.h < selectionRect.y + selectionRect.h);
    if (e.touches.length > 0) { lastTouchX = e.touches[0].clientX; lastTouchY = e.touches[0].clientY; }
    draggingComp = null; selectionStart = null; selectionRect = null; lastPinchDist = null;
});


canvas.addEventListener('wheel', (e) => {
    e.preventDefault();

    const mouseWorld = toWorld(e.clientX, e.clientY);

    const zoomSpeed = 0.1;
    const zoomDir = e.deltaY < 0 ? 1 : -1;
    const newScale = scale * (1 + zoomDir * zoomSpeed);

    scale = Math.min(Math.max(newScale, 0.1), 4);

    offsetX = e.clientX - mouseWorld.x * scale;
    offsetY = e.clientY - mouseWorld.y * scale;
});

canvas.addEventListener('mousedown', (e) => {
    
    // 屏蔽右键
    if (e.button !== 0) return;

    isMouseDown = true;

    const world = toWorld(e.clientX, e.clientY);
    lastMouseX = e.clientX;
    lastMouseY = e.clientY;

    // 双击
    const now = Date.now();
    const isDBL = now - lastMouseTap < 300;
    lastMouseTap = now;

    let clickedAny = false;
    const hitRadius = 20 / scale;

    // 点击逻辑
    for (let i = components.length - 1; i >= 0; i--) {
        let c = components[i];
        // 删除
        if (isDBL && world.x > c.x && world.x < c.x + c.w && world.y > c.y && world.y < c.y + c.h) {
            saveHistory();
            wires = wires.filter(w => w.fromId !== c.id && w.toId !== c.id);
            components.splice(i, 1);
            rebuildSimIndex();
            return;
        }
        // 点击引脚
        for (let j = 0; j < c.outputs.length; j++) {
            let outDiv = (c.type === 'REGBANK' || c.type === 'ROM16') ? 17 : (c.outputs.length + 1);
            if (Math.hypot(world.x - (c.x + c.w), world.y - (c.y + (j + 1) * (c.h / outDiv))) < hitRadius) {
                selectedNode = { fromId: c.id, fromNodeIdx: j };
                return;
            }
        }
        // 点击引脚
        for (let j = 0; j < c.inputs.length; j++) {
            let pinX = c.x, pinY = c.y + (j + 1) * (c.h / (c.inputs.length + 1));
            if (c.type === 'REGBANK' || c.type === 'ROM16') {
                pinX = c.x + (j + 1) * (c.w / 5);
                pinY = c.y + c.h;
            }
            if (Math.hypot(world.x - pinX, world.y - pinY) < hitRadius) {
                if (selectedNode && selectedNode.fromId !== c.id) {
                    saveHistory();
                    let hasWire = wires.some(w =>
                        w.fromId === selectedNode.fromId &&
                        w.fromNodeIdx === selectedNode.fromNodeIdx &&
                        w.toId === c.id &&
                        w.toNodeIdx === j
                    );
                    if (hasWire) {
                        wires = wires.filter(w =>
                            !(w.fromId === selectedNode.fromId &&
                                w.fromNodeIdx === selectedNode.fromNodeIdx &&
                                w.toId === c.id &&
                                w.toNodeIdx === j)
                        );
                    } else {
                        wires = wires.filter(w => !(w.toId === c.id && w.toNodeIdx === j));
                        wires.push({
                            fromId: selectedNode.fromId,
                            fromNodeIdx: selectedNode.fromNodeIdx,
                            toId: c.id,
                            toNodeIdx: j
                        });
                    }
                    rebuildSimIndex();
                }
                selectedNode = null;
                return;
            }
        }
        // 点击元件
        if (world.x > c.x && world.x < c.x + c.w && world.y > c.y && world.y < c.y + c.h) {
            if ((c.type === 'REGBANK' || c.type === 'ROM16') && (world.y - c.y) > 20 && (world.y - c.y) < 340) {
                let idx = Math.floor((world.y - c.y - 20) / 20);
                if (idx >= 0 && idx < 16) {
                    openBitEditor(c, idx);
                    clickedAny = true;
                    break;
                }
            } else if (c.type === 'SWITCH') {
                saveHistory();
                c.state = !c.state;
            }
            draggingComp = c;
            activeComp = c;
            clickedAny = true;
            components.push(components.splice(i, 1)[0]);
            rebuildSimIndex();
            break;
        }
    }
    // 空白处点击
    if (!clickedAny) {
        activeComp = null;
        if (isSelectMode) {
            selectionStart = { x: world.x, y: world.y };
            multiSelectedComps = [];
        }
    }
});

canvas.addEventListener('mousemove', (e) => {

    if (!isMouseDown) return; 

    const dx = e.clientX - lastMouseX;
    const dy = e.clientY - lastMouseY;

    // 拖动元件
    if (draggingComp) {
        if (multiSelectedComps.includes(draggingComp)) {
            multiSelectedComps.forEach(c => {
                c.x += dx / scale;
                c.y += dy / scale;
            });
        } else {
            draggingComp.x += dx / scale;
            draggingComp.y += dy / scale;
        }
    }
    // 框选
    else if (selectionStart) {
        const world = toWorld(e.clientX, e.clientY);
        selectionRect = {
            x: Math.min(selectionStart.x, world.x),
            y: Math.min(selectionStart.y, world.y),
            w: Math.abs(selectionStart.x - world.x),
            h: Math.abs(selectionStart.y - world.y)
        };
    }
    // 拖拽画布
    else {
        offsetX += dx;
        offsetY += dy;
    }

    lastMouseX = e.clientX;
    lastMouseY = e.clientY;
});

canvas.addEventListener('mouseup', (e) => {
    isMouseDown = false;
    if (selectionRect) {
        multiSelectedComps = components.filter(c =>
            c.x > selectionRect.x &&
            c.x + c.w < selectionRect.x + selectionRect.w &&
            c.y > selectionRect.y &&
            c.y + c.h < selectionRect.y + selectionRect.h
        );
    }
    draggingComp = null;
    selectionStart = null;
    selectionRect = null;
});

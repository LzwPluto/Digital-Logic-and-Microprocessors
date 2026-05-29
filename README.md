# 数逻视界 - 数字逻辑电路模拟器

[![License](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![Three.js](https://img.shields.io/badge/Three.js-r158-green)](https://threejs.org/)
[![Flask](https://img.shields.io/badge/Flask-2.0+-lightgrey)](https://flask.palletsprojects.com/)

**数逻视界** 是一款交互式数字逻辑电路设计与仿真工具。通过直观的图形界面，你可以自由拖放逻辑门、时序元件、存储器和 I/O 设备，构建并实时运行数字电路。项目还集成了 AI 助手，可帮助分析电路功能或根据自然语言描述生成电路结构。

![启动界面预览](./docs/preview-start.png)  
*（建议添加你的实际截图）*

## ✨ 主要特性

- **丰富的元件库**  
  基础逻辑门（AND、OR、NOT、XOR）、多输入门（AND_N/OR_N）、半加器/全加器、多路选择器（MUX2/MUX4）、触发器（DFF、JKFF、TFF）、4位计数器（CNT4）、寄存器堆（16×16）、ROM、译码器/编码器、七段/八段数码管、开关、时钟、指示灯、示波器。

- **交互式设计**  
  - 拖拽移动元件，点击引脚创建/删除连线  
  - 框选、多选、批量移动  
  - 双击元件删除  
  - 右键/双指缩放平移画布  
  - 寄存器和 ROM 支持位级编辑（十六进制/十进制）

- **实时仿真**  
  支持两种仿真模式：  
  - **标准模式**（12子步/帧）：快速收敛，理想逻辑行为  
  - **竞态模式**（1子步/帧）：暴露门延迟、毛刺、竞争冒险，适合学习物理电路特性

- **存档与分享**  
  - 保存/加载 JSON 格式电路文件  
  - 创意工坊：在本地服务器上浏览、上传、下载其他用户分享的电路

- **Verilog 导出**  
  一键生成 ModelSim 兼容的 Verilog 代码，包含自定义 ROM 模块和所有基础元件模块。

- **AI 助手**  
  - 分析当前电路结构，回答逻辑功能相关问题  
  - 根据自然语言描述自动生成电路（需配置 API Key）

## 🛠 技术栈

- **前端**：原生 JavaScript + Canvas 2D，无第三方 UI 框架  
- **3D 启动页**：Three.js  
- **后端**：Flask + Flask-CORS（提供工坊存储接口）  
- **存储**：本地文件系统（`saves/` 目录）

## 📦 安装与运行

### 1. 克隆仓库

```bash
git clone https://github.com/yourusername/logic-simulator.git
cd logic-simulator
```

### 2. 安装后端依赖（可选，用于创意工坊）

```bash
pip install flask flask-cors
```

### 3. 启动后端服务（工坊功能）

```bash
python server.py
```

服务器默认运行在 `http://localhost:5000`。

### 4. 访问应用

- 打开浏览器访问 `http://localhost:5000` 即可看到 3D 启动页面  
- 点击 **开始搭建** 进入主编辑器 `main.html`

> 若不需要工坊功能，可直接打开 `main.html` 文件（但由于同源策略，上传/加载功能会受限，建议仍使用 Flask 托管）。

## 🎮 使用指南

### 基本操作

| 操作 | 说明 |
|------|------|
| 单击元件 | 选中并拖拽移动 |
| 双击元件 | 删除元件及所有连线 |
| 单击引脚（小圆点） | 开始连线，再次单击另一元件引脚完成连线（已存在连线则删除） |
| 鼠标滚轮 / 双指缩放 | 缩放画布 |
| 鼠标拖拽空白区域 | 平移画布 |
| 按住 Ctrl / 点击“选择”按钮 | 进入多选模式，可框选或点选多个元件，批量移动 |

### 工具栏功能

- **SYSTEM**：撤销、工坊、保存/读取 JSON、选择模式、视图归位、帮助、主题切换  
- **CLOCK_CTRL**：调整时钟速度（帧间隔）、暂停/运行、竞态模式开关  
- **IO_DEVICES**：添加开关、时钟源、指示灯、示波器、数码管  
- **LOGIC_GATES**：基础门及多输入门  
- **ADV_MODULES**：加法器、多路选择器、触发器、计数器  
- **COMPLEX**：译码器/编码器、ROM、寄存器堆  
- **ACTIONS**：导出 Verilog、清空画布

### 寄存器/ROM 编辑器

双击寄存器堆或 ROM 元件的内部区域（非引脚），打开位编辑器，可逐位修改或直接输入十六进制/十进制值。

### AI 助手

1. 点击右侧 🤖 按钮打开侧边栏  
2. 首次使用需点击 **登录 / 配置API** 填写 API Key 和 URL（支持 OpenAI 兼容接口）  
3. 在输入框提问，例如：  
   - *“这个电路实现了几进制计数器？”*  
   - *“分析竞争冒险风险”*  
4. 使用 **⚡ 搭建** 功能描述电路，例如：  
   *“用 D 触发器做一个 4 位同步计数器”* — AI 将自动生成元件和连线（需手动点击“应用AI电路”）

## 📂 项目结构

```
.
├── index.html          # 3D 启动页
├── main.html           # 主编辑器界面
├── style.css           # 全局样式（暗色/亮色主题）
├── server.py           # Flask 后端
├── requirements.txt    # Python 依赖
├── js/
│   ├── core.js         # 核心渲染、逻辑更新、画布交互
│   ├── ui.js           # 工具栏、模态框、AI 前端交互
│   ├── export.js       # Verilog 导出
│   ├── bit-editor.js   # 位编辑器鼠标/触摸事件
│   └── main.js         # 入口（仅调用初始化和循环）
├── saves/              # 工坊存储目录（运行时自动创建）
└── docs/               # 建议放入截图
```

## 🤝 贡献指南

欢迎任何形式的贡献！  
- 报告 Bug 或功能建议请提交 [Issue](https://github.com/yourusername/logic-simulator/issues)  
- 提交代码请 Fork 本仓库并创建 Pull Request

开发环境建议使用 VS Code + Live Server（或直接使用 Flask 托管）。修改 `core.js` 或 `ui.js` 后刷新页面即可。

## 📄 开源协议

本项目采用 MIT 许可证，详情见 [LICENSE](LICENSE) 文件。

## 👥 作者

- **Pluto伟**  
- **我不吃辣椒**  
- **航行万里**

## 🙏 致谢

本项目受数字逻辑课程启发，所有仿真算法基于经典数字电路理论实现。AI 集成部分感谢开源大语言模型社区的支持。

---

**数逻视界** — 让数字逻辑设计变得简单而有趣。  
Happy Logicing! 🚀

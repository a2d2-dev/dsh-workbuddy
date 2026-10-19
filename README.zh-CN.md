# DSH WorkBuddy

[English](README.md) | [简体中文](README.zh-CN.md)

**在 DeepSeek Harness 里连接 WorkBuddy 账号，查看额度、比较可用模型，并直接用于 DSH 对话。**

面向 DSH web profile 的独立社区插件。当前为 **自托管 Alpha**，适合已有 DSH、能够维护 Python 服务与鉴权网关的用户。本项目不提供托管服务，也不主张获得 WorkBuddy 或 DeepSeek 的官方背书。

[开始使用](#快速上手) · [部署指南](deploy/README.md) · [安全与数据处理](SECURITY.md) · [问题反馈](SUPPORT.md)

## 能帮你做什么

- **在 DSH 里看清账号与额度：**通过浏览器登录，在「设置 → WorkBuddy」查看连接状态、Credits 余额和各额度包到期时间。
- **更容易选对模型：**按名称或 ID 搜索，区分同名入口，比较 Credits 倍率与能力，筛选上游计费或有效活动明确标为免费的模型。目录仅纳入账号可用且支持工具调用的模型。
- **沿用 DSH 的工作流：**在 WorkBuddy provider 下选择模型，使用流式响应与工具调用。浏览器授权完成后，无需持续运行 WorkBuddy 桌面客户端。

本插件独立于 A2D2 和 DimAgent 插件。[界面截图](#界面截图)展示当前体验，后续发布工作见[发布准备清单](docs/LAUNCH_READINESS.md)。

## 连接前请确认

- **第三方集成的许可：**WorkBuddy [可接受使用政策](https://www.workbuddy.ai/document/acceptable-use-policy)第 3.5、4 节限制自动化访问，并要求互操作插件及外部组件事先取得书面许可。请结合适用的[服务协议](https://www.workbuddy.ai/document/term)确认该接入方式获准后再使用。浏览器登录成功，不等于平台批准了第三方客户端。
- **一个服务共享一个账号：**每个 Python 服务管理一个 WorkBuddy 账号，同一 DSH 实例的已认证用户共享其额度和账号控制。当前没有租户隔离；不同信任边界应独立部署，并遵守上游账号规则。
- **免费状态有条件：**模型、活动、有效期及用量限制以上游账号规则为准，插件不会增加额度或提供无限使用。当前 provider 的数值成本字段对所有模型均填零，不能据此判断免费。详见[费用与限制](#费用与限制)。

## 快速上手

### 前置条件

| 需要准备 | 检查要点 |
| --- | --- |
| 已运行的 DSH web 环境 | 本地评估使用 DSH 包 `0.2.0-rc.2`；更宽的 peer-dependency 范围不等于已验证兼容范围 |
| Node.js 与 pnpm | Node.js `^22.19.0 || >=24.0.0`；使用仓库锁文件，先前评估使用 pnpm `10.4.1` |
| Python 服务主机 | Python `>=3.10`、`uv`、固定版本的 `workbuddy2api` 与常驻服务管理器 |
| 鉴权网关 | 每个转发路由都需鉴权，转发时剥离网关 Bearer 凭据，跨主机使用 HTTPS；Python 仅监听回环地址 |
| 符合条件的 WorkBuddy 账号 | 确认第三方接入获准，且账号提供适用模型 |

当前需要从源码部署多个组件。仓库有 Supervisor 示例，但**尚未提供完整的鉴权网关配置**；连接账号前，需要自行部署并验证网关。

### 从源码到第一条对话

1. **构建插件：**执行下方[安装](#安装)中的源码构建命令。
2. **准备后端：**检出固定版本的上游项目，设置私有凭据与日志路径。按照[服务部署](#服务部署)及[首次部署步骤](deploy/README.md#first-time-setup)配置。
3. **验证并连接网关：**先确认缺失和错误凭据都会被拒绝，再将插件安装到 DSH profile，配置 `gatewayBaseURL` 和 `gatewayKeyFile`。
4. **在 DSH 中授权：**进入「设置 → WorkBuddy」，点击「登录 WorkBuddy」和「打开登录页」，完成浏览器授权后回到原设置页。确认显示「已连接」、模型清单和额度信息，必要时点击「刷新」。
5. **测试一条简短对话：**在 **WorkBuddy** provider 下选择可用模型。如果要用 DeepSeek，先在目录搜索 `DeepSeek`，核对具体模型 ID、计费信息和活动截止时间。先发一条简短提示，再验证一次只读工具调用与结果回传。测试可能消耗额度。

成功标准是设置页显示账号、选中的模型能流式回复、工具结果能回到同一对话。仅显示「已连接」不足以证明推理可用。遇到问题请查看[常见检查项](SUPPORT.md#common-checks)，不要通过关闭网关鉴权排障。

## 工作方式

```text
DSH 网页 → DSH 主机插件 → 鉴权网关 → 回环地址上的 Python 服务 → WorkBuddy
```

模型请求复用 DSH 的 `PiAiAdapter`。独立运行的 Python 服务引用固定版本的 [workbuddy2api](https://github.com/Zhengyuuuui/workbuddy2api)，处理流式响应和工具调用协议转换。WorkBuddy Token 保存在服务端，浏览器只接收授权链接和账号信息；提示词、对话历史及工具数据会发送给上游进行推理。完整数据流与保留边界见 [SECURITY.md](SECURITY.md)。

## 界面截图

截图中的账号、实际额度和额度到期时间均已脱敏。模型可用性、倍率和免费活动以账号实时返回的数据为准，截图不代表长期定价承诺。

### 账号与 Credits 额度

查看连接状态、可用模型数、免费模型数，以及各额度包的余额和到期时间。

![WorkBuddy 设置页，账号与额度明细已脱敏](docs/screenshots/settings-overview.png)

### 搜索模型

支持按名称或 ID 搜索。同名模型保留不同的 ID，并分别展示 Credits 倍率、上下文、最大输出和能力。

![搜索 DeepSeek，展示两个不同 ID 和各自计费信息](docs/screenshots/deepseek-models.png)

### 免费模型筛选

勾选「仅看免费」筛选当前明确免费的模型。免费状态来自上游计费字段和有效期内的活动；未知价格不会被当作免费。

![免费模型筛选，当前显示三个模型](docs/screenshots/free-models.png)

## 费用与限制

**能免费使用 DeepSeek 吗？** 账号资格、计费与允许的接入方式由上游决定。部分模型 ID 可能有临时活动，请核对账号当前返回的模型 ID、Credits 倍率、截止时间及用量限制。截图、其他渠道的十月活动或 DSH 中的零成本估算，都不能保证通过本插件发出的请求免费。

**「仅看免费」代表什么？** 它筛选上游明确的零 Credits 计费或当前有效的活动信息，未知价格不会被当作免费。筛选结果不验证剩余活动次数，也不会覆盖每日上限、速率限制或服务条款。权威计费及权益请以 WorkBuddy 账号为准；额度「未提供」不等于余额为零。

## 安装

先核对[前置条件](#前置条件)，再克隆并构建源码：

```sh
git clone https://github.com/a2d2-dev/dsh-workbuddy.git
cd dsh-workbuddy
pnpm install --frozen-lockfile
pnpm build
```

服务与鉴权网关准备就绪后，安装到已有 DSH web profile：

```sh
dsh plugin --profile web add /absolute/path/to/dsh-workbuddy
```

在该 profile 的 `cordis.patch.yml` 中配置：

```yaml
- id: workbuddy
  config:
    gatewayBaseURL: https://workbuddy-gateway.example.com
    gatewayKeyFile: /absolute/path/to/workbuddy-gateway-key
    requestTimeoutMs: 30000
    catalogTtlMs: 60000
    streamIdleTimeoutMs: 300000
```

以上域名和路径是示例，需替换为自己的部署配置。密钥文件只包含网关的 Bearer 凭据，不要写成环境变量赋值语句。不要把 WorkBuddy 授权 Token 写入 DSH 配置或提交到仓库。网关必须启用鉴权，Python 服务应只监听回环地址，并由网关转发。

## 服务部署

已验证的上游版本为 `1cc32c9a98abb53796d8d4e8d477736fe1f0c4cc`。单独检出上游项目并切换到该版本，使用 `uv sync` 安装依赖，再通过其虚拟环境运行本插件的服务入口：

```sh
/absolute/path/to/workbuddy2api/.venv/bin/uvicorn \
  --app-dir /absolute/path/to/dsh-workbuddy/server \
  workbuddy_service:create_app --factory \
  --host 127.0.0.1 --port 18788
```

通过 Supervisor 等服务管理器配置以下环境变量：

| 变量 | 用途 |
| --- | --- |
| `WORKBUDDY_PROXY_SOURCE` | 固定版本的上游项目目录 |
| `WORKBUDDY_ENDPOINT` | WorkBuddy 后端地址，通常为 `https://www.workbuddy.ai` |
| `WORKBUDDY_SESSION_FILE` | 私有、可写的凭据文件路径，也可读取已有代理会话 |
| `WORKBUDDY_LOGIN_TTL_SECONDS` | 授权流程有效时间，单位秒，通常为 `300` |
| `WORKBUDDY_LOG_FILE` | 协议摘要日志路径 |

使用单个服务 worker 管理账号及待完成的登录流程。Token 刷新采用串行处理，凭据通过原子替换写入。退出登录会移除本服务保存的授权，不会撤销其他设备。授权链接过期后，可在设置中重新发起登录。网关访问密钥与 WorkBuddy 账号授权是两套独立凭据。

更多部署示例见 [部署指南](deploy/README.md) 和 [Supervisor 配置示例](deploy/workbuddy2api.conf)。部署更新后，应重新加载已有浏览器标签页，确认插件前端已更新。

## 验证

```sh
pnpm test
pnpm typecheck
pnpm build
```

Python 测试需使用已安装上游依赖的虚拟环境，并将上游及本插件的 `server` 目录加入 `PYTHONPATH`：

```sh
PYTHONPATH=/absolute/path/to/workbuddy2api/server:/absolute/path/to/dsh-workbuddy/server \
  /absolute/path/to/workbuddy2api/.venv/bin/pytest \
  server/test_session.py server/test_pricing.py
```

实际验收还需检查 DSH 设置页、账号授权、流式文本，以及完整的工具调用与结果回传。上游目前有一条过时的客户端请求头断言；本插件没有修改或屏蔽该断言。

## 当前限制与社区

- 当前请从源码安装。包归档仍需清理打包内容后再发布到包注册表。
- 设置页已有中英文词典，但模型描述、活动文案和模型选择器免费标记仍有中文优先或固定中文的行为。截图为中文，完整英文体验与演示仍需补齐。
- 上游协议或账号政策变化可能影响兼容性，正式使用前应在自己的部署中完成真实验收。
- [贡献与本地验证](CONTRIBUTING.md) · [问题反馈](SUPPORT.md) · [运行手册](docs/OPERATIONS.md) · [开源评估](docs/OPEN_SOURCE_REVIEW.zh-CN.md)

## 卸载

通过 DSH 插件管理器移除此插件，并停止对应的独立服务。现有 DSH provider 和会话不受影响。如果卸载前未退出登录，磁盘上的 WorkBuddy 凭据会保留。

## 许可证

本项目采用 [Apache License 2.0](LICENSE)。单独安装的上游项目保留其自身许可证。

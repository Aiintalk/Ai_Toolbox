# 镜头拆分（仅切片）离线技能参考

- 本包是**独立运行版**：`run_split_only.sh` + `split_only.config.env` 即可。
- 默认后端和配置来自包内目录：
  - `backend/`
  - `config/`
- 保持包内目录结构不变时，换到新电脑通常只需要填写配置文件里的
  `QWEN_API_KEY`，不需要修改路径或命令。

## 关键链路

1. `scan` 仅生成候选镜头信息（不分类）
2. `final_shot` 在 `final_shot_split_only.yaml` 下只做语义边界切片
3. 结果输出到 `final_shots/` 和 json，且不触发镜头分类评分

## 建议的首次流程

```bash
bash run_split_only.sh --check-only    # 首先检查环境与路径
bash run_split_only.sh                # 通过后执行完整流程
```

from __future__ import annotations

"""Stable definitions for the agreed beauty-video shot taxonomy."""

TAXONOMY_VERSION = "beauty_shot_v2"
PROMPT_VERSION = "beauty_shot_prompt_v2"

CATEGORY_LABELS: dict[str, str] = {
    "A1": "产品/包装静物",
    "A2": "手持产品展示",
    "A3": "礼盒/套装陈列",
    "A4": "包装信息细节",
    "A5": "产品与工具/配件",
    "B1": "膏霜/乳霜/膏体质地",
    "B2": "液体/油/精华质地",
    "B3": "粉体/粉霜/色彩质地",
    "B4": "延展/乳化/溶解测试",
    "C1": "整体妆容/面部状态",
    "C2": "眼部/美瞳佩戴",
    "C3": "底妆/腮红/修容上脸",
    "C4": "唇部上妆/护理",
    "C5": "护肤/清洁上脸",
    "C6": "上脸步骤过程",
    "D1": "明确前后/左右对比",
    "D2": "妆效/遮瑕/肤感变化",
    "D3": "持妆/耐久环境测试",
    "D4": "皮肤/头发状态改善",
    "D5": "卸妆/清洁前后",
    "E1": "开场/痛点/观点",
    "E2": "产品介绍/种草推荐",
    "E3": "使用方法/教程讲解",
    "E4": "功效/体验/评价",
    "E5": "结尾/互动引导口播",
    "F1": "价格/促销/购买信息",
    "F2": "物料贴图/截图/文字卡",
    "F3": "环境/氛围空镜",
    "F4": "生活方式/人物 B-roll",
    "F5": "开箱/拆包/包装过程",
    "F6": "转场/片尾/无关素材",
}


def normalize_category_code(value: object) -> str:
    """Return a valid taxonomy code, accepting common model formatting."""
    text = str(value or "").strip().upper()
    if len(text) >= 2 and text[:2] in CATEGORY_LABELS:
        return text[:2]
    return ""

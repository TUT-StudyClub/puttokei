"""LLM 判定進捗を表す値オブジェクト。"""

from enum import Enum


class JudgmentProgressStatus(str, Enum):
    """判定進捗全体の状態。"""

    QUEUED = "queued"
    RUNNING = "running"
    COMPLETED = "completed"
    FAILED = "failed"


class JudgmentProgressStage(str, Enum):
    """backend が観測できる判定処理の段階。"""

    QUEUED = "queued"
    DOWNLOADING_IMAGE = "downloading_image"
    ENCODING_IMAGE = "encoding_image"
    PREPARING_PROMPT = "preparing_prompt"
    REQUESTING_LLM = "requesting_llm"
    RECEIVING_LLM = "receiving_llm"
    VALIDATING_RESPONSE = "validating_response"
    SAVING_RESULT = "saving_result"
    COMPLETED = "completed"
    FAILED = "failed"

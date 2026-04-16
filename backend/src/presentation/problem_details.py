"""Problem Details 例外と FastAPI ハンドラー。"""

from collections.abc import Mapping, Sequence
from http import HTTPStatus
from typing import Any

from fastapi import Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from starlette.exceptions import HTTPException as StarletteHTTPException

from src.presentation.schemas.problem_schema import ProblemDetails

_DEFAULT_PROBLEM_TYPES: dict[int, str] = {
    400: "bad_request",
    401: "authentication_error",
    404: "not_found",
    409: "conflict",
    422: "validation_error",
    500: "internal_server_error",
}


class ProblemDetailsError(Exception):
    """Problem Details を返すためのアプリ内例外。"""

    def __init__(
        self,
        *,
        status_code: int,
        problem_type: str,
        title: str | None = None,
        detail: str | None = None,
        headers: Mapping[str, str] | None = None,
        errors: Sequence[Any] | None = None,
    ) -> None:
        self.status_code = status_code
        self.problem_type = problem_type
        self.title = title or _default_title(status_code)
        self.detail = detail
        self.headers = dict(headers or {})
        self.errors = errors
        super().__init__(detail or self.title)


async def problem_details_exception_handler(
    request: Request,
    exc: ProblemDetailsError,
) -> JSONResponse:
    return _build_response(
        request=request,
        status_code=exc.status_code,
        problem_type=exc.problem_type,
        title=exc.title,
        detail=exc.detail,
        headers=exc.headers,
        errors=exc.errors,
    )


async def http_exception_handler(
    request: Request,
    exc: StarletteHTTPException,
) -> JSONResponse:
    detail = exc.detail if isinstance(exc.detail, str) else None
    return _build_response(
        request=request,
        status_code=exc.status_code,
        problem_type=_DEFAULT_PROBLEM_TYPES.get(exc.status_code, "http_error"),
        title=_default_title(exc.status_code),
        detail=detail,
        headers=getattr(exc, "headers", None),
    )


async def validation_exception_handler(
    request: Request,
    exc: RequestValidationError,
) -> JSONResponse:
    return _build_response(
        request=request,
        status_code=422,
        problem_type="validation_error",
        title="Validation Error",
        detail="リクエスト内容を確認してください。",
        errors=exc.errors(),
    )


async def unexpected_exception_handler(
    request: Request,
    exc: Exception,  # noqa: ARG001
) -> JSONResponse:
    return _build_response(
        request=request,
        status_code=500,
        problem_type="internal_server_error",
        title="Internal Server Error",
        detail="予期しないエラーが発生しました。",
    )


def _build_response(
    *,
    request: Request,
    status_code: int,
    problem_type: str,
    title: str,
    detail: str | None,
    headers: Mapping[str, str] | None = None,
    errors: Sequence[Any] | None = None,
) -> JSONResponse:
    problem = ProblemDetails(
        type=problem_type,
        title=title,
        status=status_code,
        detail=detail,
        instance=request.url.path,
        errors=errors,
    )
    return JSONResponse(
        status_code=status_code,
        content=problem.model_dump(exclude_none=True, mode="json"),
        headers=dict(headers or {}),
        media_type="application/problem+json",
    )


def _default_title(status_code: int) -> str:
    try:
        return HTTPStatus(status_code).phrase
    except ValueError:
        return "Error"

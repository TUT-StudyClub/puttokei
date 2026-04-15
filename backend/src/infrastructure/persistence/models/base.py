"""SQLAlchemy の DeclarativeBase を共有するためのベースクラス。"""

from sqlalchemy.orm import DeclarativeBase


class Base(DeclarativeBase):
    """全 ORM モデルが継承する共通 Base。"""

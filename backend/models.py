from sqlalchemy import String, DateTime, ForeignKey, JSON
from sqlalchemy.orm import relationship, Mapped, mapped_column
from datetime import datetime, timezone
from backend.db import Base


class User(Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    username: Mapped[str] = mapped_column(unique=True, index=True)
    email: Mapped[str] = mapped_column(unique=True, index=True)
    hashed_password: Mapped[str] = mapped_column()
    created_at: Mapped[datetime] = mapped_column(default=lambda: datetime.now(timezone.utc))

    backtests: Mapped[list["Backtest"]] = relationship(
        back_populates="user", cascade="all, delete-orphan"
    )


class Backtest(Base):
    __tablename__ = "backtests"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"))

    strategy: Mapped[str] = mapped_column()
    ticker: Mapped[str] = mapped_column()
    start_date: Mapped[str] = mapped_column()
    end_date: Mapped[str] = mapped_column()

    stats: Mapped[str] = mapped_column()
    explanation: Mapped[str] = mapped_column()
    equity_curve: Mapped[list] = mapped_column(JSON)
    trades: Mapped[list] = mapped_column(JSON)
    classifier: Mapped[dict] = mapped_column(JSON)

    created_at: Mapped[datetime] = mapped_column(default=lambda: datetime.now(timezone.utc))

    user: Mapped["User"] = relationship(back_populates="backtests")
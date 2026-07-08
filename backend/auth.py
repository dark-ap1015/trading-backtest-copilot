from passlib.context import CryptContext
from sqlalchemy.orm import Session
from backend.models import User


pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


def hash_password(password: str) -> str:
    truncated = password.encode("utf-8")[:72].decode("utf-8", errors="ignore")
    return pwd_context.hash(truncated)


def verify_password(plain_password: str, hashed_password: str) -> bool:
    truncated = plain_password.encode("utf-8")[:72].decode("utf-8", errors="ignore")
    return pwd_context.verify(truncated, hashed_password)


def get_user_by_username(db: Session, username: str) -> User | None:
    return db.query(User).filter(User.username == username).first()


def get_user_by_email(db: Session, email: str) -> User | None:
    return db.query(User).filter(User.email == email).first()


def create_user(db: Session, username: str, email: str, password: str) -> User:
    user = User(
        username=username,
        email=email,
        hashed_password=hash_password(password),
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user
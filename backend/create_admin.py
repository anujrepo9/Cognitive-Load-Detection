
import getpass

from database.db import SessionLocal
from database.models import User  # Adjust this import to your actual model file
from passlib.context import CryptContext

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


def create_admin():
    db = SessionLocal()

    try:
        name = input("Enter admin name: ").strip()
        email = input("Enter admin email: ").strip().lower()
        password = getpass.getpass("Enter admin password: ")

        if not name or not email or not password:
            print("Name, email, and password are required.")
            return

        existing_user = db.query(User).filter(
            User.email == email
        ).first()

        if existing_user:
            print("A user with this email already exists.")
            return

        hashed_password = pwd_context.hash(password)

        admin = User(
            name=name,
            email=email,
            password=hashed_password,
            role="admin",
            is_active=True,
        )

        db.add(admin)
        db.commit()
        db.refresh(admin)

        print(f"Admin created successfully. User ID: {admin.id}")
        print(f"Admin email: {admin.email}")

    except Exception as e:
        db.rollback()
        print(f"Failed to create admin: {e}")

    finally:
        db.close()


if __name__ == "__main__":
    create_admin()
